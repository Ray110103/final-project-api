// /dashboard/report/dto/get-property-report.dto.ts
import { IsDate, IsOptional, IsString } from "class-validator";

export class GetPropertyReportDTO {
  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsDate()
  month?: Date;
}