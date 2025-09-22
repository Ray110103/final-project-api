// dto/get-property-categories.dto.ts
import { IsOptional, IsString, IsBoolean } from "class-validator";
import { Type } from "class-transformer";
import { PaginationQueryParams } from "../../pagination/dto/pagination.dto";

export class GetPropertyCategoriesDTO extends PaginationQueryParams {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}