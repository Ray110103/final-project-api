import { Request, Response } from "express";
import { TransactionService } from "./transaction.service";
import { ApiError } from "../../utils/api-error";
import { GetTransactionDTO } from "./dto/get-transaction.dto";
import { plainToInstance } from "class-transformer";
import { CancelTransactionDTO } from "./dto/cancel-transaction.dto";
import { uploadPaymentProofDTO } from "./dto/upload-payment-proof.dto";
import { CreateTransactionDTO } from "./dto/create-transaction.dto";

export class TransactionController {
  private transactionService: TransactionService;
  constructor() {
    this.transactionService = new TransactionService();
  }

 getTransactionsByTenant = async (req: Request, res: Response) => {
 // const authUserId = res.locals.user.id;
   const query = plainToInstance(GetTransactionDTO, req.query);
   const result = await this.transactionService.getTransactionsByTenant(query, 1312
    //authUserId
  );
   res.status(200).send(result);
 } 
 
   getTransactions = async (req: Request, res: Response) => {
    //const authUserId = res.locals.user.id;
    const query = plainToInstance(GetTransactionDTO, req.query);
    const result = await this.transactionService.getTransactions(query,
      //authUserId
    );
    res.status(200).send(result);
  };

  updateTransaction = async (req: Request, res: Response) => {
    //const authUserId = res.locals.user.id;
    const result = await this.transactionService.updateTransaction(req.body,1234);
    res.status(200).send(result);
  };
  cancelTransaction = async (req: Request, res: Response) => {
    //const authUserId = res.locals.user.id;
    const result = await this.transactionService.cancelTransaction(req.body,1234);
    res.status(200).send(result);
  };

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

 
}
