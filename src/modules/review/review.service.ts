// /Review/review.service.ts
import { Prisma } from "../../generated/prisma";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReviewDTO } from "./dto/create-review.dto";
import { CreateReplyDTO } from "./dto/create-reply.dto";
import { GetReviewsDTO } from "./dto/get-reviews.dto";

export class ReviewService {
  private prisma: PrismaService;
  
  constructor() {
    this.prisma = new PrismaService();
  }

  createReview = async (data: CreateReviewDTO, authUserId: number) => {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        uuid: data.transactionUuid,
        userId: authUserId,
        status: "PAID", // Only completed transactions
        endDate: { lt: new Date() }, // Check-out has occurred
      },
      include: {
        room: {
          include: {
            property: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new ApiError("Transaction not found or not eligible for review", 404);
    }

    const existingReview = await this.prisma.review.findUnique({
      where: { transactionId: transaction.id },
    });

    if (existingReview) {
      throw new ApiError("Review already exists for this transaction", 400);
    }

    const review = await this.prisma.review.create({
      data: {
        comment: data.comment,
        rating: data.rating,
        userId: authUserId,
        propertyId: transaction.room.propertyId,
        transactionId: transaction.id,
      },
      include: {
        user: true,
        property: true,
        replies: {
          include: {
            tenant: true,
          },
        },
      },
    });

    return { message: "Review created successfully", data: review };
  };

  createReply = async (data: CreateReplyDTO, authUserId: number) => {
    const review = await this.prisma.review.findUnique({
      where: { id: data.reviewId },
      include: {
        property: true,
      },
    });

    if (!review) {
      throw new ApiError("Review not found", 404);
    }

    if (review.property.tenantId !== authUserId) {
      throw new ApiError("You are not authorized to reply to this review", 403);
    }
    const reply = await this.prisma.reply.create({
      data: {
        comment: data.comment,
        reviewId: data.reviewId,
        tenantId: authUserId,
      },
      include: {
        tenant: true,
        review: {
          include: {
            user: true,
            property: true,
          },
        },
      },
    });


    return { message: "Reply created successfully", data: reply };
  };

  getReviewsByProperty = async (propertyId: number, query: GetReviewsDTO) => {
    const { page, take } = query;
    
    const whereClause: Prisma.ReviewWhereInput = {
      propertyId,
    };

    const reviews = await this.prisma.review.findMany({
      include: {
        user: true,
        replies: {
          include: {
            tenant: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take: take,
      where: whereClause,
    });

    const total = await this.prisma.review.count({
      where: whereClause,
    });

    return {
      data: reviews,
      meta: { page, take, total },
    };
  };
}