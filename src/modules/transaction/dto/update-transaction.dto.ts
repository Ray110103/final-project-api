import { IsEnum, IsNotEmpty, IsUUID } from "class-validator";

export enum TransactionType {
  ACCEPT = "ACCEPT",
  REJECT = "REJECT",
}
export class UpdateTransactionDTO {
  @IsNotEmpty()
  @IsUUID()
  uuid!: string;

  @IsNotEmpty()
  @IsEnum(TransactionType)
  type!: TransactionType;
}
