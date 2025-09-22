import { IsEmail, IsNotEmpty } from "class-validator";

export class ResendEmailVerificationDTO {
    @IsNotEmpty()
    @IsEmail()
    email!: string;
}