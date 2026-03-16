import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("bcrypt", () => ({
  default: {
    systemSetting: { findMany: vi.fn() },
    hash: vi.fn(async () => "hashed-otp"),
    compare: vi.fn(async () => true),
  },
}));

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

vi.mock("../src/services/sms.service", () => ({
  sendOTP: vi.fn(async () => undefined),
}));

import prisma from "../src/config/prisma";
import { sendOTP } from "../src/services/sms.service";
import { sendOtp } from "../src/modules/otp/otp.service";

const mockedPrisma = vi.mocked(prisma, true);

describe("otp.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sendOtp stores otpHash and triggers SMS abstraction", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      role: { roleType: "STUDENT" },
    } as never);

    mockedPrisma.otpLog.findFirst.mockResolvedValue(null as never);
    mockedPrisma.otpLog.create.mockResolvedValue({ id: "otp-1" } as never);

    await sendOtp("9876543210");

    expect(mockedPrisma.otpLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          otpHash: "hashed-otp",
        }),
      })
    );

    expect(sendOTP).toHaveBeenCalledWith("9876543210", expect.any(String));
  });
});
