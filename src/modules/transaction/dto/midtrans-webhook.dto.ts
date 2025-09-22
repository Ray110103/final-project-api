import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MidtransWebhookDTO {
  @IsNotEmpty()
  @IsString()
  order_id!: string; // we use transaction.uuid as order_id

  @IsNotEmpty()
  @IsString()
  status_code!: string;

  @IsNotEmpty()
  @IsString()
  gross_amount!: string; // Midtrans sends gross_amount as string

  @IsNotEmpty()
  @IsString()
  signature_key!: string;

  @IsNotEmpty()
  @IsIn(['capture', 'settlement', 'pending', 'deny', 'cancel', 'expire', 'refund', 'partial_refund'])
  transaction_status!: string;

  @IsOptional()
  @IsIn(['accept', 'deny', 'challenge'])
  fraud_status?: string;
}
