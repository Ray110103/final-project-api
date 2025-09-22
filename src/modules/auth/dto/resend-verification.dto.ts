// dto/resend-verification.dto.ts
import { IsEmail, IsNotEmpty } from "class-validator";

export class ResendVerificationDTO {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}