// /Review/dto/create-review.dto.ts
import { IsNotEmpty, IsNumber, IsString, IsUUID, Max, Min } from "class-validator";

export class CreateReviewDTO {
  @IsNotEmpty()
  @IsUUID()
  transactionUuid!: string;

  @IsNotEmpty()
  @IsString()
  comment!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;
}