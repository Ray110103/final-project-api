import { IsEnum } from "class-validator";

import { IsOptional, IsNumber, IsString, IsArray } from "class-validator";

export enum TransactionStatus {
  WAITING_FOR_PAYMENT = "WAITING_FOR_PAYMENT",
  WAITING_FOR_CONFIRMATION = "WAITING_FOR_CONFIRMATION",
  PAID = "PAID",
  REJECT = "REJECT",
  EXPIRED = "EXPIRED",
}

export class GetTransactionDTO {
  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  take?: number = 10;

  //   @IsOptional()
  //   @IsString()
  //   search?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsNumber()
  userId?: number;

  @IsOptional()
  @IsNumber()
  eventId?: number;

  @IsOptional()
  @IsString()
  search?: string;
}

export interface TransactionResponse {
  data: any[];
  meta: {
    page: number;
    take: number;
    total: number;
    totalPages: number;
  };
}
