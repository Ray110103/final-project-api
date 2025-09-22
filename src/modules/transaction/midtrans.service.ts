import midtransClient from 'midtrans-client';
import { MIDTRANS_CLIENT_KEY, MIDTRANS_IS_PRODUCTION, MIDTRANS_SERVER_KEY } from '../../config/env';
import { createHash } from 'crypto';

export class MidtransService {
  private snap: any;
  private core: any;

  constructor() {
    this.snap = new (midtransClient as any).Snap({
      isProduction: MIDTRANS_IS_PRODUCTION,
      serverKey: MIDTRANS_SERVER_KEY,
      clientKey: MIDTRANS_CLIENT_KEY,
    });
    this.core = new (midtransClient as any).CoreApi({
      isProduction: MIDTRANS_IS_PRODUCTION,
      serverKey: MIDTRANS_SERVER_KEY,
      clientKey: MIDTRANS_CLIENT_KEY,
    });
  }

  async createSnapTransaction(params: {
    order_id: string;
    gross_amount: number;
    customer_details?: Record<string, any>;
    item_details?: Array<Record<string, any>>;
  }): Promise<{ token: string; redirect_url: string }> {
    const payload: Record<string, any> = {
      transaction_details: {
        order_id: params.order_id,
        gross_amount: params.gross_amount,
      },
      credit_card: { secure: true },
    };

    if (params.customer_details) payload.customer_details = params.customer_details;
    if (params.item_details) payload.item_details = params.item_details;

    const tx = await this.snap.createTransaction(payload);
    return { token: tx.token, redirect_url: tx.redirect_url };
  }

  verifySignature(order_id: string, status_code: string, gross_amount: string, signature_key: string): boolean {
    const raw = `${order_id}${status_code}${gross_amount}${MIDTRANS_SERVER_KEY}`;
    const expected = createHash('sha512').update(raw).digest('hex');
    return expected === signature_key;
  }

  async getTransactionStatus(order_id: string): Promise<Record<string, any>> {
    // Uses Core API to fetch transaction status from Midtrans
    return this.core.transaction.status(order_id);
  }
}
