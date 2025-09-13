import { Type } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";
import { FacilityDTO } from "./facility.dto";

export class CreatePropertyDTO {
  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsNotEmpty()
  @IsString()
  category!: string;
  
  @IsNotEmpty()
  @IsString()
  location!: string;

  @IsNotEmpty()
  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsNotEmpty()
  @IsString()
  latitude!: string;

  @IsNotEmpty()
  @IsString()
  longtitude!: string; // keep schema spelling

  // ✅ fasilitas bisa array
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FacilityDTO)
  facilities?: FacilityDTO[];
}
