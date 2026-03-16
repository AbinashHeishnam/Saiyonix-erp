import { PaymentService } from "../../core/services/payment.service";

import type { CreateOrderInput, VerifyPaymentInput } from "./validation";

export async function createPaymentOrder(input: CreateOrderInput) {
  return PaymentService.createPaymentOrder({
    amount: input.amount,
    currency: input.currency,
    receipt: input.receipt,
    metadata: input.metadata,
  });
}

export function verifyPaymentSignature(input: VerifyPaymentInput) {
  return PaymentService.verifyPaymentSignature({
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    razorpaySignature: input.razorpaySignature,
  });
}
