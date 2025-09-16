// /Transaction/transaction.service.ts
import { Prisma } from "../../generated/prisma";
import { ApiError } from "../../utils/api-error";
import { CloudinaryService } from "../cloudinary/cloudinary.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { CancelTransactionDTO } from "./dto/cancel-transaction.dto";
import {
  CreateTransactionDTO,
  PaymentMethod,
} from "./dto/create-transaction.dto";
import {
  GetTransactionDTO,
  TransactionResponse,
  TransactionStatus,
} from "./dto/get-transaction.dto";
import { ConfirmPaymentDTO } from "./dto/confirm-payment.dto";
import { uploadPaymentProofDTO } from "./dto/upload-payment-proof.dto";
import { TransactionQueue } from "./transaction.queue";

import Xendit from "xendit-node";

export class TransactionService {
  private prisma: PrismaService;
  private transactionQueue: TransactionQueue;
  private mailService: MailService;
  private cloudinaryService: CloudinaryService;
  private xendit: any;
  private payment: any;
  

  constructor() {
    this.prisma = new PrismaService();
    this.transactionQueue = new TransactionQueue();
    this.mailService = new MailService();
    this.cloudinaryService = new CloudinaryService();
    // Initialize Xendit
    this.xendit = new Xendit({
      secretKey: process.env.XENDIT_SECRET_KEY!,
    });
    this.payment = this.xendit.Payment;
  }

  // Admin methods

  getTransactions = async (
    query: GetTransactionDTO
    //authUserId: number
  ) => {
    const { page, take, sortBy, sortOrder, status } = query;
    const whereClause: Prisma.TransactionWhereInput = {
      //userId: authUserId,
      ...(status && { status }),
    };

    const transactions = await this.prisma.transaction.findMany({
      include: {
        user: true,
        room: {
          include: {
            property: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * take,
      take: take,
      where: whereClause,
    });

    const total = await this.prisma.transaction.count({
      where: whereClause,
    });

    return {
      data: transactions,
      meta: { page, take, total },
    };
  };

  // User methods
  createTransaction = async (
    data: CreateTransactionDTO,
    authUserId: number
  ) => {
    // Check room availability
    const room = await this.prisma.room.findUnique({
      where: { id: data.roomId },
      include: {
        transactions: {
          where: {
            OR: [
              { status: "WAITING_FOR_PAYMENT" },
              { status: "WAITING_FOR_CONFIRMATION" },
              { status: "PAID" },
            ],
            AND: [
              { startDate: { lte: data.endDate } },
              { endDate: { gte: data.startDate } },
            ],
          },
        },
        roomNonAvailability: {
          where: {
            date: { gte: data.startDate, lte: data.endDate },
          },
        },
      },
    });

    if (!room) {
      throw new ApiError("Room not found", 404);
    }

    // Calculate booked quantity
    const bookedQty = room.transactions.reduce((sum, t) => sum + t.qty, 0);
    const availableQty = room.stock - bookedQty;

    if (availableQty < data.qty || room.roomNonAvailability.length > 0) {
      throw new ApiError("Room not available", 400);
    }

    // Calculate total price
    const days = Math.ceil(
      (new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    let totalPrice = Number(room.price) * days * data.qty;

    // Check for seasonal rates
    const seasonalRates = await this.prisma.seasonalRate.findMany({
      where: {
        roomId: data.roomId,
        date: { gte: data.startDate, lte: data.endDate },
      },
    });

    if (seasonalRates.length > 0) {
      totalPrice = seasonalRates.reduce(
        (sum, rate) => sum + Number(rate.price) * data.qty,
        0
      );
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        userId: authUserId,
        roomId: data.roomId,
        qty: data.qty,
        startDate: data.startDate,
        endDate: data.endDate,
        total: totalPrice,
        status: "WAITING_FOR_PAYMENT",
        paymentMethod: data.paymentMethod,
        expiredAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiry
        username: (await this.prisma.user.findUnique({ 
          where: { id: authUserId } 
        }))?.name || "",
      },
    });
    
    // Add to expiration queue
    await this.transactionQueue.addNewTransactionQueue(transaction.uuid);
    
    // Handle payment gateway integration
    if (data.paymentMethod === PaymentMethod.PAYMENT_GATEWAY) {
      try {
        const paymentLink = await this.createXenditPaymentLink(transaction, totalPrice);
        
        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            invoice_url: paymentLink.invoiceUrl,
            paymentLinkId: paymentLink.id,
          },
        });
      } catch (error) {
        // Rollback transaction if payment link creation fails
        await this.prisma.transaction.delete({
          where: { id: transaction.id },
        });
        throw new ApiError(`Payment link creation failed: ${error}`, 500);
      }
    }
    
    return { message: "Transaction created", data: transaction };
  };

    private async createXenditPaymentLink(transaction: any, amount: number) {
    return await this.payment.createPaymentLink({
      amount: amount,
      description: `Payment for room booking ${transaction.uuid}`,
      externalId: transaction.uuid,
      paymentMethods: ['BANK_TRANSFER', 'EWALLET', 'QR_CODE', 'CREDIT_CARD'],
      successRedirectUrl: `${process.env.FRONTEND_URL}/payment/success`,
      failureRedirectUrl: `${process.env.FRONTEND_URL}/payment/failure`,
      currency: 'IDR',
      metadata: {
        transactionId: transaction.id,
        userId: transaction.userId,
      },
    });
  }

  // Add this new method to handle Xendit webhooks
  handleXenditWebhook = async (payload: any, callbackToken: string) => {
    // Verify webhook token
    if (callbackToken !== process.env.XENDIT_WEBHOOK_TOKEN) {
      throw new ApiError("Invalid webhook token", 401);
    }

    const { event, data } = payload;

    // Handle payment success
    if (event === 'PAYMENT_LINK.PAID') {
      await this.processSuccessfulPayment(data);
    }
    // Handle payment expiration
    else if (event === 'PAYMENT_LINK.EXPIRED') {
      await this.processExpiredPayment(data);
    }

    return { received: true };
  };

  private async processSuccessfulPayment(paymentData: any) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { paymentLinkId: paymentData.id },
    });

    if (!transaction) {
      console.error(`Transaction not found for payment link ID: ${paymentData.id}`);
      return;
    }

    // Skip if already processed
    if (transaction.status === 'PAID') {
      return;
    }

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paymentDetails: paymentData,
        expiredAt: null,
      },
    });

    // Remove from expiration queue
    await this.transactionQueue.removeTransactionQueue(transaction.uuid);
    
    // Send payment confirmation email
    const updatedTransaction = await this.prisma.transaction.findUnique({
      where: { id: transaction.id },
      include: {
        user: true,
        room: {
          include: {
            property: true,
          },
        },
      },
    });
    
    if (updatedTransaction && updatedTransaction.user) {
      const context = {
        userName: updatedTransaction.user.name,
        transaction: updatedTransaction,
        propertyName: updatedTransaction.room.property.title,
        roomName: updatedTransaction.room.name,
        startDate: updatedTransaction.startDate,
        endDate: updatedTransaction.endDate,
        total: updatedTransaction.total,
        propertyRules: updatedTransaction.room.property.description || "No specific rules provided",
        checkInInstructions: "Please check in at the reception with your ID and booking confirmation.",
      };
      
      await this.mailService.sendMail(
        updatedTransaction.user.email,
        "Payment Confirmed - Booking Details",
        "payment-confirmation",
        context
      );
      
      // Schedule reminder email (H-1)
      const reminderDate = new Date(updatedTransaction.startDate);
      reminderDate.setDate(reminderDate.getDate() - 1);
      
      await this.transactionQueue.addReminderQueue(
        updatedTransaction.uuid,
        reminderDate
      );
    }
  }

  private async processExpiredPayment(paymentData: any) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { paymentLinkId: paymentData.id },
    });

    if (!transaction) {
      console.error(`Transaction not found for payment link ID: ${paymentData.id}`);
      return;
    }

    // Skip if already processed
    if (transaction.status === 'EXPIRED') {
      return;
    }

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'EXPIRED' },
    });
  }

  
  
  uploadPaymentProof = async (
    data: uploadPaymentProofDTO,
    authUserId: number,
    file: Express.Multer.File
  ) => {
    // Validate file
    if (!file.mimetype.match(/(jpeg|jpg|png)$/)) {
      throw new ApiError("Only .jpg or .png files are allowed", 400);
    }

    if (file.size > 1024 * 1024) {
      // 1MB
      throw new ApiError("File size must be less than 1MB", 400);
    }

    // Find transaction (excluding payment gateway transactions)
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        uuid: data.uuid,
        userId: authUserId,
        status: "WAITING_FOR_PAYMENT",
        paymentMethod: { not: PaymentMethod.PAYMENT_GATEWAY }, // Exclude Xendit payments
        expiredAt: { gt: new Date() },
      },
    });
    
    if (!transaction) {
      throw new ApiError("Transaction not found or expired", 404);
    }

    // Upload to cloud storage
    const result = await this.cloudinaryService.upload(file);
    const secure_url = result.secure_url;

    // Update transaction
    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        paymentProof: secure_url,
        status: "WAITING_FOR_CONFIRMATION",
        expiredAt: null,
      },
    });

    return { message: "Payment proof uploaded" };
  };

  getUserTransactions = async (
    query: GetTransactionDTO,
    authUserId: number
  ) => {
    const { page, take, sortBy, sortOrder, status, orderNumber, date } = query;

    const whereClause: Prisma.TransactionWhereInput = {
      userId: authUserId,
      ...(status && { status }),
      ...(orderNumber && { uuid: { contains: orderNumber } }),
      ...(date && {
        OR: [
          {
            startDate: {
              gte: new Date(date),
              lte: new Date(new Date(date).setHours(23, 59, 59, 999)),
            },
          },
          {
            endDate: {
              gte: new Date(date),
              lte: new Date(new Date(date).setHours(23, 59, 59, 999)),
            },
          },
        ],
      }),
    };

    const transactions = await this.prisma.transaction.findMany({
      include: {
        user: true,
        room: {
          include: {
            property: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * take,
      take: take,
      where: whereClause,
    });

    const total = await this.prisma.transaction.count({
      where: whereClause,
    });

    return {
      data: transactions,
      meta: { page, take, total },
    };
  };

  cancelTransactionByUser = async (
    data: CancelTransactionDTO,
    authUserId: number
  ) => {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        uuid: data.uuid,
        userId: authUserId,
        status: "WAITING_FOR_PAYMENT",
        paymentProof: null,
      },
    });

    if (!transaction) {
      throw new ApiError("Transaction cannot be cancelled", 400);
    }

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: "CANCELLED" },
    });

    // Restore room stock
    await this.prisma.room.update({
      where: { id: transaction.roomId },
      data: { stock: { increment: transaction.qty } },
    });

    return { message: "Transaction cancelled" };
  };

  // Tenant methods
  getTransactionsByTenant = async (
    query: GetTransactionDTO,
    authUserId: number
  ) => {
    const { page, take, sortBy, sortOrder, status } = query;

    if (status) {
    }

    // First, get properties owned by this tenant
    const tenantProperties = await this.prisma.property.findMany({
      where: { tenantId: authUserId },
      select: { id: true },
    });

    const propertyIds = tenantProperties.map((property) => property.id);

    const whereClause: Prisma.TransactionWhereInput = {
      room: {
        propertyId: {
          in: propertyIds,
        },
      },
    };

    const transactions = await this.prisma.transaction.findMany({
      include: {
        user: true,
        room: {
          include: {
            property: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * take,
      take: take,
      where: whereClause,
    });

    const total = await this.prisma.transaction.count({
      where: whereClause,
    });

    return {
      data: transactions,
      meta: { page, take, total },
    };
  };

  confirmPayment = async (data: ConfirmPaymentDTO, authUserId: number) => {
    const transaction = await this.prisma.transaction.findFirst({
      where: { uuid: data.uuid },
      include: {
        user: true,
        room: {
          include: {
            property: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new ApiError("Transaction not found", 400);
    }

    // Verify tenant owns this property
    if (transaction.room.property.tenantId !== authUserId) {
      throw new ApiError(
        "You are not authorized to confirm this transaction",
        403
      );
    }

    if (transaction.status !== "WAITING_FOR_CONFIRMATION") {
      throw new ApiError(
        "Transaction status must be WAITING_FOR_CONFIRMATION",
        400
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const updatedTransaction = await tx.transaction.update({
        where: { uuid: data.uuid },
        data: {
          status: data.type === "ACCEPT" ? "PAID" : "WAITING_FOR_PAYMENT",
        },
        include: {
          user: true,
          room: {
            include: {
              property: true,
            },
          },
        },
      });

      // Send email notification if PAID
      if (updatedTransaction.status === "PAID") {
        const context = {
          userName: updatedTransaction.user.name,
          transaction: updatedTransaction,
          propertyName: updatedTransaction.room.property.title,
          roomName: updatedTransaction.room.name,
          startDate: updatedTransaction.startDate,
          endDate: updatedTransaction.endDate,
          total: updatedTransaction.total,
          propertyRules:
            updatedTransaction.room.property.description ||
            "No specific rules provided",
          checkInInstructions:
            "Please check in at the reception with your ID and booking confirmation.",
        };

        // Send payment confirmation email
        await this.mailService.sendMail(
          updatedTransaction.user.email,
          "Payment Confirmed - Booking Details",
          "payment-confirmation",
          context
        );

        // Schedule reminder email (H-1)
        const reminderDate = new Date(updatedTransaction.startDate);
        reminderDate.setDate(reminderDate.getDate() - 1);

        await this.transactionQueue.addReminderQueue(
          updatedTransaction.uuid,
          reminderDate
        );
      }
    });

    return {
      message: `Payment ${data.type === "ACCEPT" ? "approved" : "rejected"}`,
    };
  };

  cancelTransactionByTenant = async (
    data: CancelTransactionDTO,
    authUserId: number
  ) => {
    const transaction = await this.prisma.transaction.findFirst({
      where: { uuid: data.uuid },
      include: {
        user: true,
        room: {
          include: {
            property: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new ApiError("Transaction not found", 400);
    }

    // Verify tenant owns this property
    if (transaction.room.property.tenantId !== authUserId) {
      throw new ApiError(
        "You are not authorized to cancel this transaction",
        403
      );
    }

    if (transaction.status !== "WAITING_FOR_PAYMENT") {
      throw new ApiError("Transaction status must be WAITING_FOR_PAYMENT", 400);
    }

    await this.prisma.$transaction(async (tx) => {
      const updatedTransaction = await tx.transaction.update({
        where: { uuid: data.uuid },
        data: { status: "CANCELLED" },
        include: {
          user: true,
          room: {
            include: {
              property: true,
            },
          },
        },
      });

      // Send cancellation email notification
      const context = {
        userName: updatedTransaction.user.name,
        transaction: updatedTransaction,
        propertyName: updatedTransaction.room.property.title,
        roomName: updatedTransaction.room.name,
      };

      await this.mailService.sendMail(
        updatedTransaction.user.email,
        "Booking Cancelled",
        "booking-cancelled",
        context
      );

      // Restore room stock
      await tx.room.update({
        where: { id: updatedTransaction.roomId },
        data: { stock: { increment: updatedTransaction.qty } },
      });
    });

    return { message: "Transaction cancelled" };
  };

  // Handle expired transactions
  expireTransactions = async () => {
    const now = new Date();
    const expiredTransactions = await this.prisma.transaction.findMany({
      where: {
        status: "WAITING_FOR_PAYMENT",
        expiredAt: { lt: now },
      },
      include: {
        room: {
          include: {
            property: true,
          },
        },
        user: true,
      },
    });

    for (const transaction of expiredTransactions) {
      await this.prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: "EXPIRED" },
        });

        // Restore room stock
        await tx.room.update({
          where: { id: transaction.roomId },
          data: { stock: { increment: transaction.qty } },
        });

        // Send expiration email
        if (transaction.user) {
          const context = {
            userName: transaction.user.name,
            transaction,
            propertyName: transaction.room.property.title || "Property",
          };

          await this.mailService.sendMail(
            transaction.user.email,
            "Booking Expired",
            "booking-expired",
            context
          );
        }
      });
    }
  };

  // Send reminder emails
  sendReminders = async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        status: "PAID",
        startDate: {
          gte: tomorrow,
          lt: dayAfterTomorrow,
        },
      },
      include: {
        user: true,
        room: {
          include: {
            property: true,
          },
        },
      },
    });

    for (const transaction of transactions) {
      const context = {
        userName: transaction.user.name,
        transaction,
        propertyName: transaction.room.property.title,
        roomName: transaction.room.name,
        propertyRules:
          transaction.room.property.description || "No specific rules provided",
        checkInInstructions:
          "Please check in at the reception with your ID and booking confirmation.",
      };

      await this.mailService.sendMail(
        transaction.user.email,
        "Reminder: Check-in Tomorrow",
        "check-in-reminder",
        context
      );
    }
  };
}

