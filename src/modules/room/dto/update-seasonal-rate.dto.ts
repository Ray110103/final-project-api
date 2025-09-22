import { IsDateString, IsEnum, IsNumberString, IsOptional, IsString } from "class-validator";
import { AdjustmentType } from "./create-seasonal-rate.dto";

export class UpdateSeasonalRateDTO {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumberString()
  @IsOptional()
  adjustmentValue?: string;

  @IsEnum(AdjustmentType)
  @IsOptional()
  adjustmentType?: AdjustmentType;

  @IsString()
  @IsOptional()
  reason?: string;
}