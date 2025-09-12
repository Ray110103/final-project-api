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
import { CancelTransactionDTO } from "./dto/cancel-transaction.dto";
import { ConfirmPaymentDTO } from "./dto/confirm-payment.dto";

export class TransactionRouter {
  private router: Router;
  private transactionController: TransactionController;
  private jwtMiddleware: JwtMiddleware;
  private uploaderMiddleware: UploaderMiddleware;
  constructor() {
    this.router = Router();
    this.jwtMiddleware = new JwtMiddleware();
    this.uploaderMiddleware = new UploaderMiddleware();
    this.transactionController = new TransactionController();
    this.intializeRoutes();
  }

  private intializeRoutes = () => {
    this.router.get(
      "/",
      //this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      //this.jwtMiddleware.verifyRole(["TENANT"]), // Requires valid JWT token
      this.transactionController.getTransactions
    );
   
    // Create new transaction
    this.router.post(
      "/",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      validateBody(CreateTransactionDTO),
      this.transactionController.createTransaction
    );

    // Upload payment proof
    this.router.patch(
      "/upload-proof",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.uploaderMiddleware.upload().single("paymentProof"),
      this.uploaderMiddleware.fileFilter(["image/jpeg", "image/png"]),
      // 1MB
      validateBody(uploadPaymentProofDTO),
      this.transactionController.uploadPaymentProof
    );

    // Cancel transaction (user side)
    this.router.patch(
      "/cancel",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      validateBody(CancelTransactionDTO),
      this.transactionController.cancelTransactionByUser
    );

    // User routes
    this.router.post(
      "/create",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET as string),
      this.jwtMiddleware.verifyRole(["USER"]),
      validateBody(CreateTransactionDTO),
      this.transactionController.createTransaction
    );


    this.router.get(
      "/user",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET as string),
      this.jwtMiddleware.verifyRole(["USER"]),
      this.transactionController.getUserTransactions
    );

    this.router.post(
      "/cancel",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET as string),
      this.jwtMiddleware.verifyRole(["USER"]),
      validateBody(CancelTransactionDTO),
      this.transactionController.cancelTransactionByUser
    );

    // Tenant routes
    this.router.get(
      "/tenant",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.transactionController.getTransactionsByTenant
    );

    this.router.post(
      "/confirm",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      validateBody(ConfirmPaymentDTO),
      this.transactionController.confirmPayment
    );

    this.router.post(
      "/cancel-tenant",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET as string),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      validateBody(CancelTransactionDTO),
      this.transactionController.cancelTransactionByTenant
    );
  };

  getRouter = () => {
    return this.router;
  };
}
