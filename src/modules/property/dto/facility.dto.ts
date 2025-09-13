import { IsNotEmpty, IsString } from "class-validator";

export class FacilityDTO {
  @IsNotEmpty()
  @IsString()
  title!: string;
}
