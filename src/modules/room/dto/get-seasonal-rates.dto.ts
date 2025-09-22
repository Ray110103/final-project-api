import { IsDateString, IsNumberString, IsOptional, IsString } from "class-validator";

export class GetSeasonalRatesDTO {
  @IsNumberString()
  @IsOptional()
  roomId?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumberString()
  @IsOptional()
  take?: string;

  @IsNumberString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsString()
  @IsOptional()
  sortOrder?: string;
}