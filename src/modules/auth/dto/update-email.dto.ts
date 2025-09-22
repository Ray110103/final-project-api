import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class UpdateEmailDTO {
    @IsNotEmpty()
    @IsEmail()
    newEmail!: string;
    
    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    password!: string;
}