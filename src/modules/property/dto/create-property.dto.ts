import { IsNotEmpty, IsOptional, IsString } from "class-validator";

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

  // @IsNotEmpty()
  // @IsString()
  // facilities!: string[];

  @IsOptional()
  @IsString()
  address?: string;

  @IsNotEmpty()
  @IsString()
  latitude!: string;

  @IsNotEmpty()
  @IsString()
  longtitude!: string; // keep schema spelling
}
