import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsNotEmpty, IsNumberString, IsOptional, IsString } from "class-validator";

export enum AdjustmentType {
  PERCENTAGE = "PERCENTAGE",
  NOMINAL = "NOMINAL"
}

export class CreateSeasonalRateDTO {
  @IsNumberString()
  @IsNotEmpty()
  roomId!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @IsNumberString()
  @IsNotEmpty()
  adjustmentValue!: string; // Nilai kenaikan (bisa persentase atau nominal)

  @IsEnum(AdjustmentType)
  @IsNotEmpty()
  adjustmentType!: AdjustmentType; // PERCENTAGE atau NOMINAL

  @IsString()
  @IsOptional()
  reason?: string; // Alasan kenaikan (contoh: "Long Weekend", "Public Holiday")
}