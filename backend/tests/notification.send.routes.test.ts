import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";
import request from "supertest";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

vi.mock("../src/utils/jwt", () => ({
  verifyToken: vi.fn(),
  signToken: vi.fn(),
}));

vi.mock("../src/modules/auth/permission.service", () => ({
  roleHasPermission: vi.fn(),
}));

import app from "../src/app";
import prisma from "../src/config/prisma";
import { roleHasPermission } from "../src/modules/auth/permission.service";
import { verifyToken } from "../src/utils/jwt";

const mockedPrisma = vi.mocked(prisma, true);
const mockedVerifyToken = vi.mocked(verifyToken);
const mockedRoleHasPermission = vi.mocked(roleHasPermission);

const adminPayload = {
  sub: "user-1",
  email: "admin@saiyonix.test",
  roleId: "role-1",
  roleType: "ADMIN",
  schoolId: "school-1",
};

describe("notification send routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifyToken.mockReturnValue(adminPayload);
    mockedRoleHasPermission.mockResolvedValue(true);

    mockedPrisma.user.findMany.mockResolvedValue([{ id: "user-1" }] as never);
    mockedPrisma.notification.create.mockResolvedValue({ id: "notif-1" } as never);

    mockedPrisma.$transaction.mockImplementation(async (input) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }
      return input(mockedPrisma as never);
    });
  });

  it("POST /notifications/send sends a notification", async () => {
    const response = await request(app)
      .post("/api/v1/notifications/send")
      .set("Authorization", "Bearer valid-token")
      .send({
        title: "Announcement",
        body: "Hello",
        priority: "LOW",
        targetType: "ENTIRE_SCHOOL",
      });

    expect(response.status).toBe(201);
    expect(response.body?.success).toBe(true);
  });
});
