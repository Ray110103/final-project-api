// /Transaction/transaction.controller.ts
import { Request, Response } from "express";
import { TransactionService } from "./transaction.service";
import { ApiError } from "../../utils/api-error";
import { GetTransactionDTO } from "./dto/get-transaction.dto";
import { plainToInstance } from "class-transformer";
import { CancelTransactionDTO } from "./dto/cancel-transaction.dto";
import { uploadPaymentProofDTO } from "./dto/upload-payment-proof.dto";
import { CreateTransactionDTO } from "./dto/create-transaction.dto";
import { ConfirmPaymentDTO } from "./dto/confirm-payment.dto";
import { PaymentGatewayWebhookDTO } from "./dto/payment-gateway-webhook.dto";

export class TransactionController {
  private transactionService: TransactionService;
  constructor() {
    this.transactionService = new TransactionService();
  }

  // Admin

    getTransactions = async (req: Request, res: Response) => {
    //const authUserId = res.locals.user.id;
    const query = plainToInstance(GetTransactionDTO, req.query);
    const result = await this.transactionService.getTransactions(query,
      //authUserId
    );
    res.status(200).send(result);
  };

  // User endpoints
  createTransaction = async (req: Request, res: Response) => {
    const authUserId = res.locals.user.id;
    const body = plainToInstance(CreateTransactionDTO, req.body);
    const result = await this.transactionService.createTransaction(body, authUserId);
    res.status(201).send(result);
  };
  
  uploadPaymentProof = async (req: Request, res: Response) => {
    const authUserId = res.locals.user.id;
    const file = req.file as Express.Multer.File;
    const body = plainToInstance(uploadPaymentProofDTO, req.body);
    const result = await this.transactionService.uploadPaymentProof(body, authUserId, file);
    res.status(200).send(result);
  };
  
  getUserTransactions = async (req: Request, res: Response) => {
    const authUserId = res.locals.user.id;
    const query = plainToInstance(GetTransactionDTO, req.query);
    const result = await this.transactionService.getUserTransactions(query, authUserId);
    res.status(200).send(result);
  };
  
  cancelTransactionByUser = async (req: Request, res: Response) => {
    const authUserId = res.locals.user.id;
    const body = plainToInstance(CancelTransactionDTO, req.body);
    const result = await this.transactionService.cancelTransactionByUser(body, authUserId);
    res.status(200).send(result);
  };

  // Tenant endpoints
  getTransactionsByTenant = async (req: Request, res: Response) => {
    const authUserId = res.locals.user.id;
    const query = plainToInstance(GetTransactionDTO, req.query);
    const result = await this.transactionService.getTransactionsByTenant(query, authUserId);
    res.status(200).send(result);
  };
  
  confirmPayment = async (req: Request, res: Response) => {
    const authUserId = res.locals.user.id;
    const body = plainToInstance(ConfirmPaymentDTO, req.body);
    const result = await this.transactionService.confirmPayment(body, authUserId);
    res.status(200).send(result);
  };
  
  cancelTransactionByTenant = async (req: Request, res: Response) => {
    const authUserId = res.locals.user.id;
    const body = plainToInstance(CancelTransactionDTO, req.body);
    const result = await this.transactionService.cancelTransactionByTenant(body, authUserId);
    res.status(200).send(result);
  };

  // Webhook (no auth)
  paymentGatewayWebhook = async (req: Request, res: Response) => {
    const body = plainToInstance(PaymentGatewayWebhookDTO, req.body);
    const result = await this.transactionService.paymentGatewayWebhook(body);
    res.status(200).send(result);
  };
}