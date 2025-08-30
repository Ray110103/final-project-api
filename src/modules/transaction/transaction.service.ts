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

  // getBlogBySlug = async (slug: string) => {
  //   const blog = await this.prisma.blog.findFirst({
  //     where: { slug },
  //   });

  //   if (!blog) {
  //     throw new ApiError("blog not found", 404);
  //   }

  //   return blog;
  // };

  getTransactionsByTenant = async (
    query: GetTransactionDTO,
    authUserId: number
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

  getTransactions = async (query: GetTransactionDTO
    ,authUserId: number
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
}
