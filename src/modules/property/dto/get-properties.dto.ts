// dto/get-properties.dto.ts (Unified and Enhanced)
import { IsOptional, IsString, IsInt, Min, Max, IsIn, IsDateString, IsNumberString } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetPropertiesDTO {
  // Basic search parameters
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string; // Category slug for filtering

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  // Date filtering for availability check
  @IsOptional()
  @IsDateString()
  checkInDate?: string;

  @IsOptional()
  @IsDateString()
  checkOutDate?: string;

  // Capacity filtering
  @IsOptional()
  @IsNumberString()
  capacity?: string; // String karena dari query parameter, akan di-convert ke number

  // Alias untuk location (dari search form)
  @IsOptional()
  @IsString()
  destination?: string;

  // Pagination parameters
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take: number = 10;

  // Sorting parameters
  @IsOptional()
  @IsString()
  @IsIn(['createdAt', 'title', 'location', 'city'])
  sortBy: string = 'createdAt';

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}