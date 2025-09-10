import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class FacilityDTO {
  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  icon?: string;
}
