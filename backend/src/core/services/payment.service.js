import crypto from "crypto";
import Razorpay from "razorpay";
import { getRazorpayConfig } from "@/core/config/externalServices";
import { ApiError } from "@/core/errors/apiError";
async function ensureRazorpayEnabled() {
    const razorpayConfig = await getRazorpayConfig();
    if (!razorpayConfig.enabled || !razorpayConfig.keyId || !razorpayConfig.keySecret) {
        throw new ApiError(400, "Razorpay integration is not configured");
    }
    return razorpayConfig;
}
let razorpayClient = null;
let razorpayClientKey = null;
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
    async createPaymentOrder(input) {
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
        return order;
    },
    async verifyPaymentSignature(input) {
        const razorpayConfig = await ensureRazorpayEnabled();
        const payload = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
        const expected = crypto
            .createHmac("sha256", razorpayConfig.keySecret)
            .update(payload)
            .digest("hex");
        return expected === input.razorpaySignature;
    },
    async fetchRazorpayOrderStatus(orderId) {
        await ensureRazorpayEnabled();
        const client = await getRazorpayClient();
        if (!client) {
            throw new ApiError(400, "Razorpay integration is not configured");
        }
        const order = await client.orders.fetch(orderId);
        return order;
    },
};
