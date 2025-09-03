import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class CreateRoomsDTO {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  property!: string;

  @IsNumberString()
  @IsNotEmpty()
  price!: string;

  @IsNumberString()
  @IsNotEmpty()
  limit!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;
}
