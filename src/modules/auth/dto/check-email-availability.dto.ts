import { IsEmail, IsNotEmpty } from "class-validator";

export class CheckEmailAvailabilityDTO {
    @IsNotEmpty()
    @IsEmail()
    email!: string;
}