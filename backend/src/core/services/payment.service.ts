import crypto from "crypto";

import { razorpayConfig } from "../config/externalServices";
import { ApiError } from "../errors/apiError";

export type CreatePaymentOrderInput = {
  amount: number;
  currency: string;
  receipt?: string;
  metadata?: Record<string, unknown>;
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

function ensureRazorpayEnabled() {
  if (!razorpayConfig.enabled || !razorpayConfig.keyId || !razorpayConfig.keySecret) {
    throw new ApiError(400, "Razorpay integration is not configured");
  }
}

function buildAuthHeader() {
  if (!razorpayConfig.keyId || !razorpayConfig.keySecret) {
    return "";
  }
  return `Basic ${Buffer.from(
    `${razorpayConfig.keyId}:${razorpayConfig.keySecret}`
  ).toString("base64")}`;
}

export const PaymentService = {
  async createPaymentOrder(
    input: CreatePaymentOrderInput
  ): Promise<CreatePaymentOrderResult> {
    ensureRazorpayEnabled();

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.metadata,
      }),
    });

    if (!response.ok) {
      throw new ApiError(502, "Failed to create Razorpay order");
    }

    const data = (await response.json()) as CreatePaymentOrderResult;
    return data;
  },

  verifyPaymentSignature(input: VerifyPaymentSignatureInput): boolean {
    ensureRazorpayEnabled();

    const payload = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
    const expected = crypto
      .createHmac("sha256", razorpayConfig.keySecret as string)
      .update(payload)
      .digest("hex");

    return expected === input.razorpaySignature;
  },
};
