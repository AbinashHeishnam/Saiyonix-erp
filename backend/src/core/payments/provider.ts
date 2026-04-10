export interface PaymentProvider {
  createOrder(amount: number): Promise<unknown>;
  verifyPayment(payload: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): Promise<boolean>;
}

class MockProvider implements PaymentProvider {
  async createOrder(amount: number) {
    return {
      provider: "MOCK",
      status: "READY",
      amount,
    };
  }

  async verifyPayment() {
    return process.env.NODE_ENV !== "production";
  }
}

class RazorpayProvider implements PaymentProvider {
  async createOrder(amount: number) {
    const { PaymentService } = await import("../services/payment.service.js");
    return PaymentService.createPaymentOrder({
      amount,
      currency: "INR",
    });
  }

  async verifyPayment(payload: {
    orderId: string;
    paymentId: string;
    signature: string;
  }) {
    if (!payload.orderId || !payload.paymentId || !payload.signature) {
      return false;
    }
    const { PaymentService } = await import("../services/payment.service.js");
    return PaymentService.verifyPaymentSignature({
      razorpayOrderId: payload.orderId,
      razorpayPaymentId: payload.paymentId,
      razorpaySignature: payload.signature,
    });
  }
}

export function getPaymentProvider(type: "MOCK" | "RAZORPAY") {
  if (type === "RAZORPAY") return new RazorpayProvider();
  return new MockProvider();
}
