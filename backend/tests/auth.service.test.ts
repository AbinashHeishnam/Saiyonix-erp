import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(() => "access-token"),
  },
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "refresh-token"),
}));

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

vi.mock("../src/utils/password", () => ({
  hashPassword: vi.fn(async () => "hashed-password"),
  comparePassword: vi.fn(async () => true),
}));

vi.mock("../src/utils/audit", () => ({
  logAudit: vi.fn(async () => undefined),
}));

import prisma from "../src/config/prisma";
import { comparePassword } from "../src/utils/password";
import { loginUser, registerUser } from "../src/modules/auth/auth.service";

const mockedPrisma = vi.mocked(prisma, true);

describe("auth.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "super-secret-for-tests";
  });

  it("registerUser adds required schoolId from default school", async () => {
    mockedPrisma.school.findUnique.mockResolvedValue({ id: "school-1" } as never);
    mockedPrisma.user.create.mockResolvedValue({ id: "user-1" } as never);

    await registerUser({
      email: "admin@example.com",
      password: "password123",
      roleId: "role-1",
    });

    expect(mockedPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "school-1",
        }),
      })
    );
  });

  it("loginUser returns token pair and creates 7-day session", async () => {
    const now = Date.now();
    vi.setSystemTime(new Date(now));

    mockedPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "admin@example.com",
      schoolId: "school-1",
      roleId: "role-1",
      role: { roleType: "ADMIN" },
      passwordHash: "hash",
      failedLoginAttempts: 0,
      lockUntil: null,
      createdAt: new Date(now),
    } as never);

    mockedPrisma.user.update.mockResolvedValue({} as never);
    mockedPrisma.session.create.mockResolvedValue({} as never);

    vi.mocked(comparePassword).mockResolvedValue(true);

    const result = await loginUser({
      email: "admin@example.com",
      password: "password123",
    });

    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toBe("refresh-token");

    const sessionArgs = mockedPrisma.session.create.mock.calls[0][0] as {
      data: { expiresAt: Date };
    };

    const diff = sessionArgs.data.expiresAt.getTime() - now;
    expect(diff).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 1000);
    expect(diff).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 1000);

    vi.useRealTimers();
  });
});
