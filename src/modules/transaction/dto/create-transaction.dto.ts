// create-transaction.dto.ts
import { IsArray, ValidateNested, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";

// DTO untuk satu item transaksi
export class TransactionItemDTO {
  @IsInt()
  @Min(1)
  ticketId!: number;

  @IsInt()
  @Min(1)
  qty!: number;
}

// DTO utama untuk transaksi
export class CreateTransactionDTO {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionItemDTO)
  payload!: TransactionItemDTO[];
}