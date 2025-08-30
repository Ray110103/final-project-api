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
    this.router.get(
      "/",
      this.jwtMiddleWare.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleWare.verifyRole(["TENANT"]), // Requires valid JWT token
      this.transactionController.getTransactions
    );
    this.router.get(
      "/tenant",
      this.jwtMiddleWare.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleWare.verifyRole(["TENANT"]), // Requires valid JWT token
      
      this.transactionController.getTransactionsByTenant
    );
  };

  getRouter = () => {
    return this.router;
  };
}
