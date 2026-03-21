import { createHmac } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RazorpayGateway {
  constructor(private readonly configService: ConfigService) {}

  async createOrder(payload: {
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }) {
    const auth = Buffer.from(
      `${this.configService.getOrThrow<string>('RAZORPAY_KEY_ID')}:${this.configService.getOrThrow<string>('RAZORPAY_KEY_SECRET')}`,
    ).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: payload.amount * 100,
        currency: payload.currency,
        receipt: payload.receipt,
        notes: payload.notes,
      }),
    });

    if (!response.ok) {
      throw new Error(`Razorpay order creation failed with status ${response.status}`);
    }

    return (await response.json()) as {
      id: string;
      amount: number;
      currency: string;
      receipt: string;
      status: string;
    };
  }

  verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
    const digest = createHmac(
      'sha256',
      this.configService.getOrThrow<string>('RAZORPAY_KEY_SECRET'),
    )
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return digest === signature;
  }

  verifyWebhookSignature(rawBody: Buffer, signature?: string) {
    if (!signature) {
      return false;
    }

    const digest = createHmac(
      'sha256',
      this.configService.getOrThrow<string>('RAZORPAY_WEBHOOK_SECRET'),
    )
      .update(rawBody)
      .digest('hex');

    return digest === signature;
  }
}
