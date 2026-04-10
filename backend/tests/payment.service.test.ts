import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };
const razorpayMocks = vi.hoisted(() => ({
  createSpy: vi.fn(),
}));

vi.mock("razorpay", () => ({
  default: vi.fn().mockImplementation(() => ({
    orders: {
      create: razorpayMocks.createSpy,
    },
  })),
}));

function setBaseEnv() {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/test";
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-12345";
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  vi.resetModules();
  razorpayMocks.createSpy.mockReset();
});

describe("payment.service", () => {
  it("throws when Razorpay keys are missing", async () => {
    setBaseEnv();
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;

    const { PaymentService } = await import("../src/core/services/payment.service");

    await expect(
      PaymentService.createPaymentOrder({
        amount: 1000,
        currency: "INR",
        receipt: "rcpt-1",
      })
    ).rejects.toThrow("Razorpay integration is not configured");
  });

  it("verifies payment signature", async () => {
    setBaseEnv();
    process.env.RAZORPAY_KEY_ID = "key";
    process.env.RAZORPAY_KEY_SECRET = "secret";

    const { PaymentService } = await import("../src/core/services/payment.service");

    const payload = "order123|payment456";
    const signature = await import("crypto").then((crypto) =>
      crypto
        .createHmac("sha256", "secret")
        .update(payload)
        .digest("hex")
    );

    const result = PaymentService.verifyPaymentSignature({
      razorpayOrderId: "order123",
      razorpayPaymentId: "payment456",
      razorpaySignature: signature,
    });

    expect(result).toBe(true);
  });

  it("creates Razorpay order when configured", async () => {
    setBaseEnv();
    process.env.RAZORPAY_KEY_ID = "key";
    process.env.RAZORPAY_KEY_SECRET = "secret";

    razorpayMocks.createSpy.mockResolvedValue({
      id: "order_1",
      amount: 1000,
      currency: "INR",
    });

    const { PaymentService } = await import("../src/core/services/payment.service");

    const result = await PaymentService.createPaymentOrder({
      amount: 1000,
      currency: "INR",
      receipt: "rcpt-1",
    });

    expect(result.id).toBe("order_1");
    expect(razorpayMocks.createSpy).toHaveBeenCalledTimes(1);
    expect(razorpayMocks.createSpy).toHaveBeenCalledWith({
      amount: 1000,
      currency: "INR",
      receipt: "rcpt-1",
      notes: undefined,
    });
  });
});
