// dto/update-property-category.dto.ts
import { IsOptional, IsString, IsBoolean, MinLength, MaxLength } from "class-validator";
import { Type } from "class-transformer";

export class UpdatePropertyCategoryDTO {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Category name must be at least 2 characters long" })
  @MaxLength(50, { message: "Category name must not exceed 50 characters" })
  name?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}