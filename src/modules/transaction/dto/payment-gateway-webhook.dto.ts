import { IsEnum, IsNotEmpty, IsUUID } from "class-validator";

export enum GatewayPaymentStatus {
  PAID = "PAID",
  FAILED = "FAILED",
}

export class PaymentGatewayWebhookDTO {
  @IsNotEmpty()
  @IsUUID()
  uuid!: string;

  @IsNotEmpty()
  @IsEnum(GatewayPaymentStatus)
  status!: GatewayPaymentStatus;
}
