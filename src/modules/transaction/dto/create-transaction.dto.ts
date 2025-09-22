// create-transaction.dto.ts
import { IsNotEmpty, IsNumber, IsDateString, IsEnum } from 'class-validator';

export enum PaymentMethod {
  MANUAL_TRANSFER = 'MANUAL_TRANSFER',
  PAYMENT_GATEWAY = 'PAYMENT_GATEWAY'
}


// DTO utama untuk transaksi
export class CreateTransactionDTO {
  @IsNotEmpty()
  @IsNumber()
  roomId!: number;

  @IsNotEmpty()
  @IsNumber()
  qty!: number;

  @IsNotEmpty()
  @IsDateString()
  startDate!: string;

  @IsNotEmpty()
  @IsDateString()
  endDate!: string;

  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}