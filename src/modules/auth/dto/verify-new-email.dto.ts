import { IsNotEmpty, IsString } from "class-validator";

export class VerifyNewEmailDTO {
    @IsNotEmpty()
    @IsString()
    token!: string;
}