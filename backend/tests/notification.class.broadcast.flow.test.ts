import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createMockPrisma } from "./helpers/mockPrisma";

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

function setupTransaction() {
  mockedPrisma.$transaction.mockImplementation(async (input) => {
    if (Array.isArray(input)) {
      return Promise.all(input);
    }
    return input(mockedPrisma as never);
  });
}

describe("notification class broadcast flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTransaction();

    mockedVerifyToken.mockReturnValue(adminPayload as never);
    mockedRoleHasPermission.mockResolvedValue(true as never);

    mockedPrisma.studentEnrollment.findMany.mockResolvedValue([
      { student: { userId: "student-1" } },
      { student: { userId: "student-2" } },
    ] as never);
    mockedPrisma.notification.create.mockResolvedValue({ id: "notif-1" } as never);
    mockedPrisma.notificationRecipient.createMany.mockResolvedValue({ count: 2 } as never);
  });

  it("sends a class notification and returns it in inbox", async () => {
    const sendResponse = await request(app)
      .post("/api/v1/notifications/send")
      .set("Authorization", "Bearer valid-token")
      .send({
        title: "Class Update",
        body: "Details",
        priority: "LOW",
        targetType: "CLASS",
        classId: "11111111-1111-1111-8111-111111111111",
      });

    expect(sendResponse.status).toBe(201);
    expect(mockedPrisma.notification.create).toHaveBeenCalled();
    expect(mockedPrisma.notificationRecipient.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: "student-1" }),
          expect.objectContaining({ userId: "student-2" }),
        ]),
      })
    );

    mockedPrisma.notificationRecipient.findMany.mockResolvedValue([
      {
        id: "recipient-1",
        readAt: null,
        createdAt: new Date("2026-03-01"),
        notification: {
          id: "notif-1",
          title: "Class Update",
          body: "Details",
          category: null,
          priority: "LOW",
          sentAt: new Date("2026-03-01"),
          createdAt: new Date("2026-03-01"),
        },
      },
    ] as never);
    mockedPrisma.notificationRecipient.count.mockResolvedValue(1 as never);

    const inboxResponse = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", "Bearer valid-token");

    expect(inboxResponse.status).toBe(200);
    expect(inboxResponse.body?.data?.[0]?.notification?.id).toBe("notif-1");
  });
});
