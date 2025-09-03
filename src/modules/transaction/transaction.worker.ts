import { Job, Worker } from "bullmq";
import { connection } from "../../config/redis";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../../utils/api-error";

export class TransactionWorker {
  private worker: Worker;
  private prisma: PrismaService;
  constructor() {
    this.prisma = new PrismaService();
    this.worker = new Worker("transactionQueue", this.handleTransaction, {
      connection,
    });
  }
  private handleTransaction = async (job: Job<{ uuid: string }>) => {
    const uuid = job.data.uuid;

    const transaction = await this.prisma.transaction.findFirst({
      where: { uuid },
    });
    if (!transaction) {
      throw new ApiError("Transaction not found", 400);
    }

    if (transaction.status === "WAITING_FOR_PAYMENT") {
      await this.prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { uuid },
          data: { status: "EXPIRED" },
        });

        // ambil semua transaction detail
        const transactionDetails = await tx.transaction.findMany({
          where: { uuid: transaction.uuid },
        });
        //balikin stock yang di checkout pertama kali
        for (const detail of transactionDetails) {
          await tx.room.update({
            where: { id: detail.roomId },
            data: {
              stock: {
                increment: detail.qty, // Tambahkan kembali jumlah yang dibeli ke stok
              },
            },
          });
        }
      });
    }
    // Optional: Tambahkan log atau notifikasi
    console.log(`Transaction ${uuid} expired and stock has been restored`);
  };
}
