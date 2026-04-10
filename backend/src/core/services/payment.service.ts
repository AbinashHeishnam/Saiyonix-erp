import crypto from "crypto";
import Razorpay from "razorpay";

import { getRazorpayConfig } from "@/core/config/externalServices";
import { ApiError } from "@/core/errors/apiError";

export type CreatePaymentOrderInput = {
  amount: number;
  currency: string;
  receipt?: string;
  metadata?: Record<string, string | number | null>;
};

export type CreatePaymentOrderResult = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status?: string;
  notes?: Record<string, unknown>;
};

export type VerifyPaymentSignatureInput = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

async function ensureRazorpayEnabled() {
  const razorpayConfig = await getRazorpayConfig();
  if (!razorpayConfig.enabled || !razorpayConfig.keyId || !razorpayConfig.keySecret) {
    throw new ApiError(400, "Razorpay integration is not configured");
  }
  return razorpayConfig;
}

let razorpayClient: Razorpay | null = null;
let razorpayClientKey: string | null = null;

async function getRazorpayClient() {
  const razorpayConfig = await getRazorpayConfig();
  if (!razorpayConfig.keyId || !razorpayConfig.keySecret) {
    return null;
  }
  const nextKey = `${razorpayConfig.keyId}:${razorpayConfig.keySecret}`;
  if (!razorpayClient || razorpayClientKey !== nextKey) {
    razorpayClient = new Razorpay({
      key_id: razorpayConfig.keyId,
      key_secret: razorpayConfig.keySecret,
    });
    razorpayClientKey = nextKey;
  }
  return razorpayClient;
}

export const PaymentService = {
  async createPaymentOrder(
    input: CreatePaymentOrderInput
  ): Promise<CreatePaymentOrderResult> {
    await ensureRazorpayEnabled();

    const client = await getRazorpayClient();
    if (!client) {
      throw new ApiError(400, "Razorpay integration is not configured");
    }

    const order = await client.orders.create({
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.metadata,
    });

    return order as unknown as CreatePaymentOrderResult;
  },

  async verifyPaymentSignature(input: VerifyPaymentSignatureInput): Promise<boolean> {
    const razorpayConfig = await ensureRazorpayEnabled();

    const payload = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
    const expected = crypto
      .createHmac("sha256", razorpayConfig.keySecret as string)
      .update(payload)
      .digest("hex");

    return expected === input.razorpaySignature;
  },
};
