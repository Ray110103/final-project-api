import { Decimal } from "@prisma/client/runtime/library";
import { IsDate, IsDecimal, IsEnum } from "class-validator";

import { IsOptional, IsNumber, IsString, IsArray } from "class-validator";
import { PaginationQueryParams } from "../../pagination/dto/pagination.dto";

export enum TransactionStatus {
  WAITING_FOR_PAYMENT = "WAITING_FOR_PAYMENT",
  WAITING_FOR_CONFIRMATION = "WAITING_FOR_CONFIRMATION",
  PAID = "PAID",
  REJECT = "REJECT",
  EXPIRED = "EXPIRED",
}

export class GetTransactionDTO extends PaginationQueryParams {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus =
    TransactionStatus.WAITING_FOR_PAYMENT ||
    TransactionStatus.WAITING_FOR_CONFIRMATION ||
    TransactionStatus.PAID ||
    TransactionStatus.EXPIRED ||
    TransactionStatus.REJECT;

  @IsOptional()
  @IsNumber()
  userId?: number;

  @IsOptional()
  @IsString()
  roomid?: string;

  @IsOptional()
  @IsNumber()
  total?: Number;

  @IsOptional()
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @IsDate()
  endDate?: Date;
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
