import { IsEnum, IsNotEmpty, IsUUID } from "class-validator";

export enum TransactionType {
  CANCELLED = "CANCELLED",
}
export class CancelTransactionDTO {
  @IsNotEmpty()
  @IsUUID()
  uuid!: string;

  @IsNotEmpty()
  @IsEnum(TransactionType)
  type!: TransactionType;
}
