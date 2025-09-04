import { Prisma } from "../../generated/prisma";
import { ApiError } from "../../utils/api-error";
import { CloudinaryService } from "../cloudinary/cloudinary.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTransactionDTO } from "./dto/create-transaction.dto";
import {
  GetTransactionDTO,
  TransactionResponse,
  TransactionStatus,
} from "./dto/get-transaction.dto";
import { UpdateTransactionDTO } from "./dto/update-transaction.dto";
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
      select: { id: true }
    });
    
    const propertyIds = tenantProperties.map(property => property.id);
    
    const whereClause: Prisma.TransactionWhereInput = {
      room: {
        propertyId: {
          in: propertyIds
        }
      },
      ...(status && { status })
    };

    const transactions = await this.prisma.transaction.findMany({
      include: { 
        user: true,
        room: {
          include: {
            property: true
          }
        }
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
  getTransactions = async (query: GetTransactionDTO, authUserId: number) => {
    const { page, take, sortBy, sortOrder, status } = query;
    const whereClause: Prisma.TransactionWhereInput = {
      userId: authUserId,
      ...(status && { status })
    };
    
    const transactions = await this.prisma.transaction.findMany({
      include: { 
        user: true,
        room: {
          include: {
            property: true
          }
        }
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
  updateTransaction = async (body: UpdateTransactionDTO, authUserId: number) => {
    const transaction = await this.prisma.transaction.findFirst({
      where: { uuid: body.uuid },
      include: {
        user: true,
        room: {
          include: {
            property: true
          }
        }
      }
    });

    if (!transaction) {
      throw new ApiError("Transaction not found", 400);
    }
    
    // Verify tenant owns this property
    if (transaction.room.property.tenantId !== authUserId) {
      throw new ApiError("You are not authorized to update this transaction", 403);
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
              property: true
            }
          }
        }
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
          propertyRules: updatedTransaction.room.property.description || "No specific rules provided",
          checkInInstructions: "Please check in at the reception with your ID and booking confirmation.",
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
  cancelTransaction = async (body: UpdateTransactionDTO, authUserId: number) => {
    const transaction = await this.prisma.transaction.findFirst({
      where: { uuid: body.uuid },
      include: {
        user: true,
        room: {
          include: {
            property: true
          }
        }
      }
    });

    if (!transaction) {
      throw new ApiError("Transaction not found", 400);
    }
    
    // Verify tenant owns this property
    if (transaction.room.property.tenantId !== authUserId) {
      throw new ApiError("You are not authorized to cancel this transaction", 403);
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
              property: true
            }
          }
        }
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
}