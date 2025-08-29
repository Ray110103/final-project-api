import { Router } from "express";
import { JwtMiddleware } from "../../middlewares/jwt.middleware";
import { UploaderMiddleware } from "../../middlewares/uploader.middleware";
import { validateBody } from "../../middlewares/validation.middleware";
import { CreateTransactionDTO } from "./dto/create-transaction.dto";
import { UpdateTransactionDTO } from "./dto/update-transaction.dto";
import { uploadPaymentProofDTO } from "./dto/upload-payment-proof.dto";
import { TransactionController } from "./transaction.controller";
import { get } from "http";
import { GetTransactionDTO } from "./dto/get-transaction.dto";

export class TransactionRouter {
  private router: Router;
  private transactionController: TransactionController;
  private jwtMiddleWare: JwtMiddleware;
  private uploaderMiddleware: UploaderMiddleware;
  constructor() {
    this.router = Router();
    this.jwtMiddleWare = new JwtMiddleware();
    this.uploaderMiddleware = new UploaderMiddleware();
    this.transactionController = new TransactionController();
    this.intializeRoutes();
  }

  private intializeRoutes = () => {
    this.router.post(
      "/",
      this.jwtMiddleWare.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleWare.verifyRole(["CUSTOMER"]),
      validateBody(CreateTransactionDTO),
      this.transactionController.createTransaction
    );
    this.router.patch(
      "/payment-proof",
      this.jwtMiddleWare.verifyToken(process.env.JWT_SECRET!),
      this.uploaderMiddleware
        .upload()
        .fields([{ name: "paymentProof", maxCount: 1 }]),
      this.uploaderMiddleware.fileFilter([
        "image/jpeg",
        "image/png",
        "image/heic",
        "image/avif",
      ]),
      validateBody(uploadPaymentProofDTO),
      this.transactionController.uploadPaymentProof
    );

    this.router.patch(
      "/",
      this.jwtMiddleWare.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleWare.verifyRole(["ORGANIZER"]),
      validateBody(UpdateTransactionDTO),
      this.transactionController.updateTransaction
    );
    this.router.get(
      '/',
      this.jwtMiddleWare.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleWare.verifyRole(["ORGANIZER"]),// Requires valid JWT token
      validateBody(GetTransactionDTO),
      this.transactionController.getTransactionsOrganizer
    );
  };

  getRouter = () => {
    return this.router;
  };
}
