import { IsNotEmpty, IsUUID } from "class-validator";

export class uploadPaymentProofDTO {
  @IsNotEmpty()
  @IsUUID()
  uuid!: string;
}
