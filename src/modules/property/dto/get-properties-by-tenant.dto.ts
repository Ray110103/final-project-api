// dto/get-properties-by-tenant.dto.ts
import { IsOptional, IsString, IsInt, IsIn } from "class-validator";

export class GetPropertiesByTenantDTO {
  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";

  @IsOptional()
  @IsInt()
  take?: number;

  @IsOptional()
  @IsInt()
  page?: number;
}
