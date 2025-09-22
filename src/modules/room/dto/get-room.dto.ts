import { IsOptional, IsString, IsNumberString, IsDateString } from "class-validator";

export class GetRoomsDTO {
  @IsOptional()
  @IsString()
  property?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: string;

  @IsOptional()
  @IsNumberString()
  page: string = "1";

  @IsOptional()
  @IsNumberString()
  take: string = "10";

  // New search fields
  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsDateString()
  checkInDate?: string;

  @IsOptional()
  @IsDateString()
  checkOutDate?: string;

  @IsOptional()
  @IsNumberString()
  capacity?: string;
}
