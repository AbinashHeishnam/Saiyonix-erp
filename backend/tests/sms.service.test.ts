import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

function setBaseEnv() {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/test";
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-12345";
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("sms.service", () => {
  it("skips sending when SMS_API_KEY is missing", async () => {
    setBaseEnv();
    process.env.SMS_PROVIDER = "msg91";
    delete process.env.SMS_API_KEY;
    delete process.env.SMS_PROVIDER_KEY;
    process.env.SMS_SENDER_ID = "SENDER";

    const fetchSpy = vi.fn();
    // @ts-expect-error test override
    globalThis.fetch = fetchSpy;

    const { sendSMS } = await import("../src/core/services/sms.service");
    await sendSMS({ phoneNumber: "+919999999999", message: "Test" });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls provider when configured", async () => {
    setBaseEnv();
    process.env.SMS_PROVIDER = "msg91";
    process.env.SMS_API_KEY = "test-key";
    process.env.SMS_SENDER_ID = "SENDER";

    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    // @ts-expect-error test override
    globalThis.fetch = fetchSpy;

    const { sendSMS } = await import("../src/core/services/sms.service");
    await sendSMS({ phoneNumber: "+919999999999", message: "Test" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
