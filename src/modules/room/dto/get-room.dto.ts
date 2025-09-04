import { IsOptional, IsString } from "class-validator";

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
  @IsString()
  page: string = "1";

  @IsOptional()
  @IsString()
  take: string = "10";
}
