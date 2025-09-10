import { IsEnum, IsNotEmpty, IsUUID } from "class-validator";

export enum PaymentAction {
  ACCEPT = "ACCEPT",
  REJECT = "REJECT",
}

export class ConfirmPaymentDTO {
  @IsNotEmpty()
  @IsUUID()
  uuid!: string;

  @IsNotEmpty()
  @IsEnum(PaymentAction)
  action!: PaymentAction;
}