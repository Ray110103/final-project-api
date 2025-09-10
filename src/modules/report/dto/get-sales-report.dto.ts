// /dashboard/report/dto/get-sales-report.dto.ts
import { IsDate, IsOptional, IsString } from "class-validator";
import { PaginationQueryParams } from "../../pagination/dto/pagination.dto";

export class GetSalesReportDTO extends PaginationQueryParams {
  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @IsDate()
  endDate?: Date;

//   @IsOptional()
//   @IsString()
//   sortBy?: string = "createdAt";

//   @IsOptional()
//   @IsString()
//   sortOrder?: "asc" | "desc" = "desc";
}