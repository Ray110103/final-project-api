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
import { UpdateTransactionDTO } from "./dto/update-transaction.dto";
import { uploadPaymentProofDTO } from "./dto/upload-payment-proof.dto";
import { TransactionQueue } from "./transaction.queue";

export class TransactionService {
  private prisma: PrismaService;
  private transactionQueue: TransactionQueue;
  private mailService: MailService;
  private cloudinaryService: CloudinaryService;

  constructor() {
    this.prisma = new PrismaService();
    this.transactionQueue = new TransactionQueue();
    this.mailService = new MailService();
    this.cloudinaryService = new CloudinaryService();
  }

  // Get transactions for a specific tenant
  getTransactionsByTenant = async (
    query: GetTransactionDTO,
    authUserId: number
  ) => {
    const { page, take, sortBy, sortOrder, status } = query;

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

  // Get transactions for a user
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

  // Update transaction status (accept/reject payment)
  updateTransaction = async (
    body: UpdateTransactionDTO,
    authUserId: number
  ) => {
    const transaction = await this.prisma.transaction.findFirst({
      where: { uuid: body.uuid },
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
        "You are not authorized to update this transaction",
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
        where: { uuid: body.uuid },
        data: {
          status: body.type === "ACCEPT" ? "PAID" : "WAITING_FOR_PAYMENT",
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
        // Prepare email context with transaction details and property rules
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
          // Add any other relevant details
        };

        // Send payment confirmation email
        await this.mailService.sendMail(
          updatedTransaction.user.email,
          "Payment Confirmed - Booking Details",
          "payment-confirmation",
          context
        );
      }
    });

    return { message: "update transaction success" };
  };

  // Cancel transaction
  cancelTransaction = async (
    body: UpdateTransactionDTO,
    authUserId: number
  ) => {
    const transaction = await this.prisma.transaction.findFirst({
      where: { uuid: body.uuid },
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
        where: { uuid: body.uuid },
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
        // Add any other relevant details
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

    return { message: "cancel transaction success" };
  };
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
      // Apply seasonal rate logic (simplified)
      totalPrice = seasonalRates.reduce(
        (sum, rate) => sum + Number(rate.price) * data.qty,
        0
      );
    }

    // Create transaction
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
        username:
          (
            await this.prisma.user.findUnique({ where: { id: authUserId } })
          )?.name || "",
      },
    });

    // Handle payment gateway integration
    if (data.paymentMethod === PaymentMethod.PAYMENT_GATEWAY) {
      // This would integrate with your payment gateway
      const invoiceUrl = `https://payment-gateway.example.com/invoice/${transaction.uuid}`;
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { invoice_url: invoiceUrl },
      });
    }

    return { message: "Transaction created", data: transaction };
  };

  uploadPaymentProof = async (
    data: uploadPaymentProofDTO,
    authUserId: number,
    file: Express.Multer.File
  ) => {
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

    return { message: "Transaction cancelled" };
  };

  // Add this method to handle expired transactions
  expireTransactions = async () => {
    const now = new Date();
    await this.prisma.transaction.updateMany({
      where: {
        status: "WAITING_FOR_PAYMENT",
        expiredAt: { lt: now },
      },
      data: { status: "EXPIRED" },
    });
  };
}
