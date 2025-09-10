// /Review/dto/create-reply.dto.ts
import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateReplyDTO {
  @IsNotEmpty()
  @IsNumber()
  reviewId!: number;

  @IsNotEmpty()
  @IsString()
  comment!: string;
}