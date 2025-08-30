import { Request, Response } from "express";
import { TransactionService } from "./transaction.service";
import { ApiError } from "../../utils/api-error";
import { GetTransactionDTO } from "./dto/get-transaction.dto";
import { plainToInstance } from "class-transformer";

export class TransactionController {
  private transactionService: TransactionService;
  constructor() {
    this.transactionService = new TransactionService();
  }

 getTransactionsByTenant = async (req: Request, res: Response) => {
  const authUserId = res.locals.user.id;
   const query = plainToInstance(GetTransactionDTO, req.query);
   const result = await this.transactionService.getTransactionsByTenant(query, 
    authUserId
  );
   res.status(200).send(result);
 } 
 
   getTransactions = async (req: Request, res: Response) => {
      const authUserId = res.locals.user.id;
    const query = plainToInstance(GetTransactionDTO, req.query);
    const result = await this.transactionService.getTransactions(query,authUserId);
    res.status(200).send(result);
  };
 
}
