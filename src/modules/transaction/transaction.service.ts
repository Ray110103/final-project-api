// /Transaction/transaction.service.ts
import { Prisma } from "../../generated/prisma";
import { ApiError } from "../../utils/api-error";
import { CloudinaryService } from "../cloudinary/cloudinary.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { CancelTransactionDTO } from "./dto/cancel-transaction.dto";
import { CreateTransactionDTO, PaymentMethod } from "./dto/create-transaction.dto";
import {
  GetTransactionDTO,
  TransactionResponse,
  TransactionStatus,
} from "./dto/get-transaction.dto";
import { ConfirmPaymentDTO } from "./dto/confirm-payment.dto";
import { MidtransWebhookDTO } from "./dto/midtrans-webhook.dto";
import { uploadPaymentProofDTO } from "./dto/upload-payment-proof.dto";
import { TransactionQueue } from "./transaction.queue";
import { MidtransService } from "./midtrans.service";
import { GetSnapTokenDTO } from "./dto/get-snap-token.dto";

export class TransactionService {
  private prisma: PrismaService;
  private transactionQueue: TransactionQueue;
  private mailService: MailService;
  private cloudinaryService: CloudinaryService;
  private midtransService: MidtransService;
  
  constructor() {
    this.prisma = new PrismaService();
    this.transactionQueue = new TransactionQueue();
    this.mailService = new MailService();
    this.cloudinaryService = new CloudinaryService();
    this.midtransService = new MidtransService();
  }

  // Payment gateway webhook handler (Midtrans)
  paymentGatewayWebhook = async (data: MidtransWebhookDTO) => {
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = data;

    // Verify Midtrans signature
    const isValid = this.midtransService.verifySignature(order_id, status_code, gross_amount, signature_key);
    if (!isValid) {
      throw new ApiError("Invalid signature", 401);
    }

    const transaction = await this.prisma.transaction.findFirst({
      where: { uuid: order_id },
      include: {
        user: true,
        room: { include: { property: true } },
      },
    });

    if (!transaction) {
      throw new ApiError("Transaction not found", 404);
    }

    if (transaction.paymentMethod !== PaymentMethod.PAYMENT_GATEWAY) {
      throw new ApiError("Invalid payment method for webhook", 400);
    }

    // Map Midtrans status -> our TransactionStatus
    if (
      transaction_status === "settlement" ||
      (transaction_status === "capture" && fraud_status !== "deny")
    ) {
      const updated = await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "PAID",
          expiredAt: null,
        },
        include: {
          user: true,
          room: { include: { property: true } },
        },
      });

      // Send payment confirmation email
      const context = {
        userName: updated.user.name,
        transaction: updated,
        propertyName: updated.room.property.title,
        roomName: updated.room.name,
        startDate: updated.startDate,
        endDate: updated.endDate,
        total: updated.total,
        propertyRules: updated.room.property.description || "No specific rules provided",
        checkInInstructions: "Please check in at the reception with your ID and booking confirmation.",
      };

      await this.mailService.sendMail(
        updated.user.email,
        "Payment Confirmed - Booking Details",
        "payment-confirmation",
        context
      );

      // Schedule reminder (H-1)
      const reminderDate = new Date(updated.startDate);
      reminderDate.setDate(reminderDate.getDate() - 1);
      await this.transactionQueue.addReminderQueue(updated.uuid, reminderDate);

      // Schedule stock release at endDate
      await this.transactionQueue.addReleaseQueue(
        updated.uuid,
        new Date(updated.endDate)
      );

      return { message: "Payment confirmed via Midtrans" };
    }

    if (transaction_status === "expire") {
      await this.prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: "EXPIRED" },
        });

        await tx.room.update({
          where: { id: transaction.roomId },
          data: { stock: { increment: transaction.qty } },
        });
      });
      return { message: "Payment expired via Midtrans" };
    }

    if (transaction_status === "cancel" || transaction_status === "deny" || transaction_status === "refund") {
      await this.prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: "CANCELLED" },
        });

        await tx.room.update({
          where: { id: transaction.roomId },
          data: { stock: { increment: transaction.qty } },
        });
      });
      return { message: "Payment cancelled/denied via Midtrans" };
    }

    // pending or challenge -> keep waiting
    return { message: "Webhook processed (pending/challenge)" };
  };

  // Admin methods

  getTransactions = async (
    query: GetTransactionDTO,
    authUserId: number
  ) => {
    const { page, take, sortBy, sortOrder, status, orderNumber, date } = query;

    const normalizeStatus = (s: any): TransactionStatus | undefined => {
      if (!s) return undefined;
      const value = String(s).toUpperCase();
      if (value === "ALL") return undefined;
      return (Object.values(TransactionStatus) as string[]).includes(value)
        ? (value as TransactionStatus)
        : undefined;
    };

    const normalizedStatus = normalizeStatus(status as any);

    const whereClause: Prisma.TransactionWhereInput = {
      userId: authUserId,
      ...(normalizedStatus && { status: normalizedStatus }),
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


  // User methods
  createTransaction = async (data: CreateTransactionDTO, authUserId: number) => {
    // Parse and validate dates, and calculate days once
    const startDateObj = new Date(data.startDate);
    const endDateObj = new Date(data.endDate);
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      throw new ApiError("Invalid date format. Use ISO 8601 (e.g., 2025-09-17 or 2025-09-17T00:00:00Z).", 400);
    }
    // Inclusive range for the end date when filtering per-day records
    const endDateInclusive = new Date(endDateObj);
    endDateInclusive.setHours(23, 59, 59, 999);
    const days = Math.ceil(
      (endDateObj.getTime() - startDateObj.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const transaction = await this.prisma.$transaction(async (tx) => {
      // Load room with non-availability
      const room = await tx.room.findUnique({
        where: { id: data.roomId },
        include: {
          roomNonAvailability: {
            where: {
              date: { gte: startDateObj, lte: endDateInclusive },
            },
          },
        },
      });

      if (!room) throw new ApiError("Room not found", 404);

      // Validate stock and blackout dates
      if (room.stock < data.qty || room.roomNonAvailability.length > 0) {
        throw new ApiError("Room not available", 400);
      }

      // Compute total price with seasonal rates
      let totalPrice = Number(room.price) * days * data.qty;
      const seasonalRates = await tx.seasonalRate.findMany({
        where: {
          roomId: data.roomId,
          date: { gte: startDateObj, lte: endDateInclusive },
        },
      });
      if (seasonalRates.length > 0) {
        totalPrice = seasonalRates.reduce(
          (sum, rate) => sum + Number(rate.price) * data.qty,
          0
        );
      }

      const user = await tx.user.findUnique({ where: { id: authUserId } });

      // Create transaction
      const created = await tx.transaction.create({
        data: {
          userId: authUserId,
          roomId: data.roomId,
          qty: data.qty,
          startDate: startDateObj,
          endDate: endDateObj,
          total: totalPrice,
          status: "WAITING_FOR_PAYMENT",
          paymentMethod: data.paymentMethod,
          expiredAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiry
          username: user?.name || "",
        },
      });

      // Decrement stock immediately (restored on cancel/expire/release)
      await tx.room.update({
        where: { id: data.roomId },
        data: { stock: { decrement: data.qty } },
      });

      return created;
    });

    // Queue expiration
    await this.transactionQueue.addNewTransactionQueue(transaction.uuid);

    // Payment gateway via Midtrans Snap
    let redirectUrl: string | undefined;
    if (data.paymentMethod === PaymentMethod.PAYMENT_GATEWAY) {
      const snapTx = await this.midtransService.createSnapTransaction({
        order_id: transaction.uuid,
        gross_amount: transaction.total,
        customer_details: {
          first_name: transaction.username,
        },
        item_details: [
          {
            id: String(transaction.roomId),
            price: transaction.total,
            quantity: 1,
            name: "Room booking",
          },
        ],
      });
      redirectUrl = snapTx.redirect_url;
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { invoice_url: redirectUrl },
      });
    }

    return { message: "Transaction created", data: { ...transaction, invoice_url: redirectUrl ?? transaction.invoice_url } };
  };

  // Generate Midtrans Snap token for existing transaction
  getSnapToken = async (data: GetSnapTokenDTO, authUserId: number) => {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        uuid: data.uuid,
        userId: authUserId,
        status: "WAITING_FOR_PAYMENT",
        expiredAt: { gt: new Date() },
        paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
      },
      include: {
        user: true,
      },
    });

    if (!transaction) {
      throw new ApiError("Transaction not found or not eligible for gateway", 404);
    }

    const snapTx = await this.midtransService.createSnapTransaction({
      order_id: transaction.uuid,
      gross_amount: transaction.total,
      customer_details: {
        first_name: transaction.username,
      },
      item_details: [
        {
          id: String(transaction.roomId),
          price: transaction.total,
          quantity: 1,
          name: "Room booking",
        },
      ],
    });

    return { token: snapTx.token, redirect_url: snapTx.redirect_url };
  };

  // Fallback: refresh status by querying Midtrans Core API
  refreshStatus = async (data: GetSnapTokenDTO, authUserId: number) => {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        uuid: data.uuid,
        userId: authUserId,
        paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
      },
      include: {
        user: true,
        room: { include: { property: true } },
      },
    });

    if (!transaction) {
      throw new ApiError("Transaction not found", 404);
    }

    const statusResp: any = await this.midtransService.getTransactionStatus(transaction.uuid);
    const txStatus: string = statusResp.transaction_status;
    const fraudStatus: string | undefined = statusResp.fraud_status;

    if (
      txStatus === "settlement" ||
      (txStatus === "capture" && fraudStatus !== "deny")
    ) {
      const updated = await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: "PAID", expiredAt: null },
        include: {
          user: true,
          room: { include: { property: true } },
        },
      });

      // Send payment confirmation email and schedule jobs (mirror webhook)
      const context = {
        userName: updated.user.name,
        transaction: updated,
        propertyName: updated.room.property.title,
        roomName: updated.room.name,
        startDate: updated.startDate,
        endDate: updated.endDate,
        total: updated.total,
        propertyRules: updated.room.property.description || "No specific rules provided",
        checkInInstructions: "Please check in at the reception with your ID and booking confirmation.",
      };

      await this.mailService.sendMail(
        updated.user.email,
        "Payment Confirmed - Booking Details",
        "payment-confirmation",
        context
      );

      const reminderDate = new Date(updated.startDate);
      reminderDate.setDate(reminderDate.getDate() - 1);
      await this.transactionQueue.addReminderQueue(updated.uuid, reminderDate);

      await this.transactionQueue.addReleaseQueue(updated.uuid, new Date(updated.endDate));

      return { message: "Updated to PAID", data: updated, midtrans: statusResp };
    }

    if (txStatus === "expire") {
      await this.prisma.$transaction(async (tx) => {
        await tx.transaction.update({ where: { id: transaction.id }, data: { status: "EXPIRED" } });
        await tx.room.update({ where: { id: transaction.roomId }, data: { stock: { increment: transaction.qty } } });
      });
      return { message: "Updated to EXPIRED", midtrans: statusResp };
    }

    if (txStatus === "cancel" || txStatus === "deny" || txStatus === "refund") {
      await this.prisma.$transaction(async (tx) => {
        await tx.transaction.update({ where: { id: transaction.id }, data: { status: "CANCELLED" } });
        await tx.room.update({ where: { id: transaction.roomId }, data: { stock: { increment: transaction.qty } } });
      });
      return { message: "Updated to CANCELLED", midtrans: statusResp };
    }

    // pending / challenge: do not change
    return { message: "No change (pending/challenge)", midtrans: statusResp };
  };

  uploadPaymentProof = async (
    data: uploadPaymentProofDTO,
    authUserId: number,
    file: Express.Multer.File
  ) => {
    // Validate file
    if (!file.mimetype.match(/(jpeg|jpg|png)$/)) {
      throw new ApiError("Only .jpg or .png files are allowed", 400);
    }
    
    if (file.size > 1024 * 1024) { // 1MB
      throw new ApiError("File size must be less than 1MB", 400);
    }

    // Find transaction
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        uuid: data.uuid,
        userId: authUserId,
        status: "WAITING_FOR_PAYMENT",
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
    const { page, take, sortBy, sortOrder, status, orderNumber, date } = query;

    // First, get properties owned by this tenant
    const tenantProperties = await this.prisma.property.findMany({
      where: { tenantId: authUserId },
      select: { id: true },
    });
    
    const propertyIds = tenantProperties.map((property) => property.id);

    const normalizeStatus = (s: any): TransactionStatus | undefined => {
      if (!s) return undefined;
      const value = String(s).toUpperCase();
      if (value === "ALL") return undefined;
      return (Object.values(TransactionStatus) as string[]).includes(value)
        ? (value as TransactionStatus)
        : undefined;
    };

    const normalizedStatus = normalizeStatus(status as any);

    const whereClause: Prisma.TransactionWhereInput = {
      room: {
        propertyId: {
          in: propertyIds,
        },
      },
      ...(normalizedStatus && { status: normalizedStatus }),
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

  confirmPayment = async (
    data: ConfirmPaymentDTO,
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
          status: data.action === "ACCEPT" ? "PAID" : "WAITING_FOR_PAYMENT",
          ...(data.action === "REJECT" && { expiredAt: new Date(Date.now() + 60 * 60 * 1000) }),
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
          propertyRules: updatedTransaction.room.property.description || "No specific rules provided",
          checkInInstructions: "Please check in at the reception with your ID and booking confirmation.",
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

        // Schedule stock release at endDate
        await this.transactionQueue.addReleaseQueue(
          updatedTransaction.uuid,
          new Date(updatedTransaction.endDate)
        );
      } else {
        // Re-queue expiration for rejected payments
        await this.transactionQueue.addNewTransactionQueue(updatedTransaction.uuid);
      }
    });

    return { message: `Payment ${data.action === "ACCEPT" ? "approved" : "rejected"}` };
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
          property: true
        }
      },
      user: true
    }
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
        propertyRules: transaction.room.property.description || "No specific rules provided",
        checkInInstructions: "Please check in at the reception with your ID and booking confirmation.",
      };

      await this.mailService.sendMail(
        transaction.user.email,
        "Reminder: Check-in Tomorrow",
        "checkin-reminder",
        context
      );
    }
  };
}