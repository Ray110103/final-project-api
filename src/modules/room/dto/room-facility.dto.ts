import { IsNotEmpty, IsString } from "class-validator";

export class RoomFacilityDTO {
  @IsNotEmpty()
  @IsString()
  title!: string;
}