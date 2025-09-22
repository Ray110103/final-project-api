import { Type } from "class-transformer";
import { IsOptional, IsString, ValidateNested, IsInt, Min } from "class-validator";
import { FacilityDTO } from "./facility.dto";

export class UpdatePropertyDTO {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number; // Changed from category string to categoryId number
  
  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  latitude?: string;

  @IsOptional()
  @IsString()
  longtitude?: string; // keep schema spelling

  // ✅ fasilitas bisa array
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FacilityDTO)
  facilities?: FacilityDTO[];
}