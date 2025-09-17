// /dashboard/report/dto/get-property-report.dto.ts
import { IsDate, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";

export class GetPropertyReportDTO {
  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  month?: Date;
}