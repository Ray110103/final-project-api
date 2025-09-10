// /Review/review.routes.ts
import { Router } from "express";
import { ReviewController } from "./review.controller";
import { JwtMiddleware } from "../../middlewares/jwt.middleware";
import { validateBody } from "../../middlewares/validation.middleware";
import { CreateReviewDTO } from "./dto/create-review.dto";
import { CreateReplyDTO } from "./dto/create-reply.dto";
import { GetReviewsDTO } from "./dto/get-reviews.dto";

export class ReviewRouter {
  private router: Router;
  private reviewController: ReviewController;
  private jwtMiddleware: JwtMiddleware;
  
  constructor() {
    this.router = Router();
    this.jwtMiddleware = new JwtMiddleware();
    this.reviewController = new ReviewController();
    this.initializeRoutes();
  }
  
  private initializeRoutes = () => {
    // User creates a review
    this.router.post(
      "/create",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["USER"]),
      validateBody(CreateReviewDTO),
      this.reviewController.createReview
    );
    
    // Tenant replies to a review
    this.router.post(
      "/reply",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      validateBody(CreateReplyDTO),
      this.reviewController.createReply
    );
    
    // Get reviews for a property
    this.router.get(
      "/property/:propertyId",
      validateBody(GetReviewsDTO),
      this.reviewController.getReviewsByProperty
    );
  };
  
  getRouter = () => {
    return this.router;
  };
}