// /dashboard/report/dto/get-sales-report.dto.ts
import { IsDate, IsIn, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";
import { PaginationQueryParams } from "../../pagination/dto/pagination.dto";

export class GetSalesReportDTO extends PaginationQueryParams {
  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  endDate?: Date;

  @IsOptional()
  @IsIn(["property", "transaction", "user"])
  groupBy: "property" | "transaction" | "user" = "property";

  @IsOptional()
  @IsIn(["date", "total"])
  sortBy: "date" | "total" = "date";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder: "asc" | "desc" = "desc";
}