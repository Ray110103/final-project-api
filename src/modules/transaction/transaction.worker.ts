import { Job, Worker } from "bullmq";
import { connection } from "../../config/redis";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../../utils/api-error";
import { TransactionService } from "./transaction.service";

export class TransactionWorker {
  private worker: Worker;
  private reminderWorker: Worker;
  private releaseWorker: Worker;
  private prisma: PrismaService;
  private transactionService: TransactionService;
  
  constructor() {
    this.prisma = new PrismaService();
    this.transactionService = new TransactionService();
    
    // Worker for expired transactions
    this.worker = new Worker("transactionQueue", this.handleExpiredTransaction, {
      connection,
    });
    
    // Worker for reminders
    this.reminderWorker = new Worker("reminderQueue", this.handleReminder, {
      connection,
    });

    // Worker for releasing stock at endDate
    this.releaseWorker = new Worker("releaseQueue", this.handleRelease, {
      connection,
    });
  }

  private handleExpiredTransaction = async (job: Job<{ uuid: string }>) => {
    const uuid = job.data.uuid;
    
    const transaction = await this.prisma.transaction.findFirst({
      where: { uuid },
    });

    if (!transaction) {
      throw new ApiError("Transaction not found", 400);
    }

    if (transaction.status === "WAITING_FOR_PAYMENT") {
      await this.transactionService.expireTransactions();
    }
  };

  private handleReminder = async (job: Job<{ uuid: string }>) => {
    await this.transactionService.sendReminders();
  };

  private handleRelease = async (job: Job<{ uuid: string }>) => {
    const uuid = job.data.uuid;
    const transaction = await this.prisma.transaction.findFirst({ where: { uuid } });

    if (!transaction) {
      throw new ApiError("Transaction not found", 400);
    }

    // Only release stock for completed stays (paid bookings)
    if (transaction.status === "PAID") {
      await this.prisma.room.update({
        where: { id: transaction.roomId },
        data: { stock: { increment: transaction.qty } },
      });
    }
  };
}