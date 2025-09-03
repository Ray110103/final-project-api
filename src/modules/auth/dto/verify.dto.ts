import { IsJWT, IsNotEmpty, IsString } from "class-validator";

export class VerifyDTO {
  @IsNotEmpty()
  @IsString()
  @IsJWT()
  token!: string;
}
