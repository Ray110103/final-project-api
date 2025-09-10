// /Review/review.controller.ts
import { Request, Response } from "express";
import { ReviewService } from "./review.service";
import { plainToInstance } from "class-transformer";
import { CreateReviewDTO } from "./dto/create-review.dto";
import { CreateReplyDTO } from "./dto/create-reply.dto";
import { GetReviewsDTO } from "./dto/get-reviews.dto";

export class ReviewController {
  private reviewService: ReviewService;
  
  constructor() {
    this.reviewService = new ReviewService();
  }

  createReview = async (req: Request, res: Response) => {
    const authUserId = res.locals.user.id;
    const body = plainToInstance(CreateReviewDTO, req.body);
    const result = await this.reviewService.createReview(body, authUserId);
    res.status(201).send(result);
  };

  createReply = async (req: Request, res: Response) => {
    const authUserId = res.locals.user.id;
    const body = plainToInstance(CreateReplyDTO, req.body);
    const result = await this.reviewService.createReply(body, authUserId);
    res.status(201).send(result);
  };

  getReviewsByProperty = async (req: Request, res: Response) => {
    const propertyId = parseInt(req.params.propertyId);
    const query = plainToInstance(GetReviewsDTO, req.query);
    const result = await this.reviewService.getReviewsByProperty(propertyId, query);
    res.status(200).send(result);
  };
}