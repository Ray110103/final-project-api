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

  createTransaction = async (
    body: CreateTransactionDTO,
    authUserId: number
  ) => {
    //validate product stock
    //if stock less than qty throw ApiError
    //create data on model transaction and model transaction detail

    const payload = body.payload; //[{productId:1, qty:1}, {productId:2 qty:4}]

    // 1. Ambil semua productId dari payload
    const ticketIds = payload.map((item) => item.ticketId); //[1,2]

    // 2. Ambil data produk dari database
    const tickets = await this.prisma.ticket.findMany({
      where: {
        id: { in: ticketIds },
      },
    });

    // 3. Validasi produk & stok
    for (const item of payload) {
      const ticket = tickets.find((t) => t.id === item.ticketId);

      if (!ticket) {
        throw new ApiError(`ticket with ID ${item.ticketId} not found`, 400);
      }

      if (ticket.stock < item.qty) {
        throw new ApiError(`Stock not enough`, 400);
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 4. buat data Transaction
      const transaction = await tx.transaction.create({
        data: {
          userId: authUserId,
          status: "WAITING_FOR_PAYMENT",
          eventId: 1,
        },
        include: { user: true },
      });

      // 5. prepare data transactionDetail
      const transactionDetails = payload.map((item) => {
        const product = tickets.find((t) => t.id === item.ticketId)!;
        return {
          transactionId: transaction.id,
          ticketId: item.ticketId,
          qty: item.qty,
          price: product.totalPrice,
        };
      });

      // 6. CreateMany data TransactionDetail based on variable transactionDetails
      await tx.transactionDetail.createMany({
        data: transactionDetails,
      });

      // 7.Update stock for each product
      for (const item of payload) {
        await tx.ticket.update({
          where: { id: item.ticketId },
          data: { stock: { decrement: item.qty } },
        });
      }

      return transaction;
    });

    // 8. buat delay job untuk 1 menit
    await this.transactionQueue.addNewTransactionQueue(result.uuid);

    // 9. kirim ke email untuk upload bukti pembayarann
    await this.mailService.sendMail(
      result.user.email,
      "upload bukti pembayaran",
      "upload-proof",
      {
        name: result.user.name,
        uuid: result.uuid,
        expireAt: new Date(result.createdAt.getTime() + 5 * 60 * 1000), // 5 menit
        year: new Date().getFullYear(),
      }
    );

    return { message: "create transaction success" };
  };

  uploadPaymentProof = async (
    uuid: string,
    paymentProof: Express.Multer.File,
    authUserId: number
  ) => {
    // harus mengetahui transaksinya
    // harus user yang punya transaksi yang bisa upload

    const transaction = await this.prisma.transaction.findFirst({
      where: { uuid: uuid },
    });
    // kalo tidak ada throw new error
    if (!transaction) {
      throw new ApiError("Transaction not found", 400);
    }
    // kalo userId di data transaksinya tidak sesuai dengan userId di dalam
    //  token throw error
    if (transaction.userId !== authUserId) {
      throw new ApiError("unauthorized", 401);
    }

    // upload bukti transfer ke cloudinary
    const { secure_url } = await this.cloudinaryService.upload(paymentProof);

    await this.prisma.transaction.update({
      where: { uuid: uuid },
      data: { paymentProof: secure_url, status: "WAITING_FOR_CONFIRMATION" },
    });

    return { message: " Upload payment proof success" };
  };

  updateTransaction = async (body: UpdateTransactionDTO) => {
    const transaction = await this.prisma.transaction.findFirst({
      where: { uuid: body.uuid },
    });

    if (!transaction) {
      throw new ApiError("Transaction not found!", 400);
    }

    if (transaction.status !== "WAITING_FOR_CONFIRMATION") {
      throw new ApiError(
        "Transaction staus must be WAITING_FOR_CONNFIRMATION",
        400
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { uuid: body.uuid },
        data: { status: body.type === "ACCEPT" ? "PAID" : "REJECT" },
      });

      if (body.type === "REJECT") {
        //ambil semua transaction detail
        const transactionDetails = await tx.transactionDetail.findMany({
          where: { transactionId: transaction.id },
        });

        //kembalikan stok produk berdasarkan transaction detail
        for (const detail of transactionDetails) {
          await tx.ticket.update({
            where: { id: detail.ticketId },
            data: { stock: { increment: detail.qty } },
          });
        }
      }
    });

    return { message: "accept transaction success" };
  };

  getTransactionsOrganizer = async (
  body: GetTransactionDTO,
  authUserId: number
) => {
  const { page, take, search, status } = body; // Add status to destructured properties

  const whereClause: Prisma.TransactionWhereInput = {
    event: {
      organizerId: body.userId,
    },
  };

  // Handle status filter separately
  if (status) {
    whereClause.status = status;
  }

  // Add general search functionality (excluding status)
  if (search) {
    whereClause.OR = [
      { uuid: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { event: { title: { contains: search, mode: "insensitive" } } },
    ];
  }

  const transactions = await this.prisma.transaction.findMany({
    where: whereClause,
    include: {
      event: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          profilePicture: true,
          role: true,
        },
      },
      TransactionDetail: {
        include: {
          ticket: true,
        },
      },
    },
    skip: page && take ? (page - 1) * take : undefined,
    take: take,
  });

  const total = await this.prisma.transaction.count({ where: whereClause });

  return {
    data: transactions,
    meta: { page, take, total },
  };
};
}
