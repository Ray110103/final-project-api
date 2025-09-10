import { Decimal } from "@prisma/client/runtime/library";
import { IsDate, IsDecimal, IsEnum } from "class-validator";

import { IsOptional, IsNumber, IsString, IsArray, IsDateString } from "class-validator";
import { PaginationQueryParams } from "../../pagination/dto/pagination.dto";

export enum TransactionStatus {
  WAITING_FOR_PAYMENT = "WAITING_FOR_PAYMENT",
  WAITING_FOR_CONFIRMATION = "WAITING_FOR_CONFIRMATION",
  PAID = "PAID",
  CANCELLED = "CANCELLED",
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
    TransactionStatus.CANCELLED;

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

   @IsOptional()
  @IsString()
  orderNumber?: string; // for searching by transaction UUID

  @IsOptional()
  @IsDateString()
  date?: string; // for filtering by transaction date
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
