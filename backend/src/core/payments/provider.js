class MockProvider {
    async createOrder(amount) {
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
class RazorpayProvider {
    async createOrder(amount) {
        const { PaymentService } = await import("../services/payment.service.js");
        return PaymentService.createPaymentOrder({
            amount,
            currency: "INR",
        });
    }
    async verifyPayment(payload) {
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
export function getPaymentProvider(type) {
    if (type === "RAZORPAY")
        return new RazorpayProvider();
    return new MockProvider();
}
