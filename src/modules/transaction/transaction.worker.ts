import { Job, Worker } from "bullmq";
import { connection } from "../../config/redis";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../../utils/api-error";
import { TransactionService } from "./transaction.service";

export class TransactionWorker {
  private worker: Worker;
  private reminderWorker: Worker;
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
}