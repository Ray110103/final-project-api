import { IsDate, IsEnum } from "class-validator";

import { IsOptional, IsNumber, IsString, IsDateString } from "class-validator";
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
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsNumber()
  userId?: number;

  @IsOptional()
  @IsString()
  roomid?: string;

   @IsOptional()
  @IsString()
  room?: string;

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
