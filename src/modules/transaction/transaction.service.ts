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

  // todo get each transaction by tenant
  getTransactionsByTenant = async (
    query: GetTransactionDTO,
    //authUserId: number
  ) => {
    const { page, take, sortBy, sortOrder, status } = query;

    const whereClause: Prisma.TransactionWhereInput = {};

    const transactions = await this.prisma.transaction.findMany({
      include: { user: true },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * take,
      take: take,
      where: { status },
    });

    const totalSuccess = await this.prisma.transaction.count({
      where: whereClause,
    });

    const total = await this.prisma.transaction.count();
    return {
      data: transactions,
      meta: { page, take, total },
    };
  };

  getTransactions = async (query: GetTransactionDTO, authUserId: number) => {
    const { page, take, sortBy, sortOrder, status } = query;

    const whereClause: Prisma.TransactionWhereInput = {};

    const transactions = await this.prisma.transaction.findMany({
      include: { user: true },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * take,
      take: take,
      where: { status },
    });

    const totalSuccess = await this.prisma.transaction.count({
      where: whereClause,
    });

    const total = await this.prisma.transaction.count();
    return {
      data: transactions,
      meta: { page, take, total },
    };
  };

  updateTransaction = async (body: UpdateTransactionDTO) => {
    const transaction = await this.prisma.transaction.findFirst({
      where: { uuid: body.uuid },
    });

    if (!transaction) {
      throw new ApiError("Transaction not found", 400);
    }

    if (transaction.status !== "WAITING_FOR_CONFIRMATION") {
      throw new ApiError(
        "Transaction status must be WAITING_FOR_CONFIRMATION",
        400
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { uuid: body.uuid },
        data: {
          status: body.type === "ACCEPT" ? "PAID" : "WAITING_FOR_PAYMENT",
        },
      });

      // make notification if PAID

     
    });

    return { message: "update transaction success" };
  };

  cancelTransaction = async (body: UpdateTransactionDTO) => {
    const transaction = await this.prisma.transaction.findFirst({
      where: { uuid: body.uuid },
    });

    if (!transaction) {
      throw new ApiError("Transaction not found", 400);
    }

    if (transaction.status !== "WAITING_FOR_PAYMENT") {
      throw new ApiError("Transaction status must be WAITING_FOR_PAYMENT", 400);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { uuid: body.uuid },
        data: { status: "CANCELLED" },
      });

      // make notification if  CANCELLED

      // if (body.type === "CANCELLED") {
      //   // balikin stock kembali semua

      //   const transactionDetails = await tx.transaction.findMany(
      //     {
      //       where: { roomid : transaction.roomid},
      //     }
      //   );

      //   for (const detail of transactionDetails) {
      //     await tx.room.update({
      //       where: { id: detail.roomid },
      //       // one room only??
      //       //data: { stock: { increment: detail.qty } },
      //       data: { stock: { increment: detail.qty  } },
      //     });
      //   }
      // }
    });

    return { message: "update transaction success" };
  };
}
