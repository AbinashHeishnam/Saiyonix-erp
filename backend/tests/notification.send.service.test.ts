import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

import prisma from "../src/config/prisma";
import { sendNotification } from "../src/modules/notification/service";

const mockedPrisma = vi.mocked(prisma, true);

const schoolId = "school-1";

function setupTransaction() {
  mockedPrisma.$transaction.mockImplementation(async (input) => {
    if (Array.isArray(input)) {
      return Promise.all(input);
    }
    return input(mockedPrisma as never);
  });
}

describe("notification.send.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTransaction();
  });

  it("sends to entire school", async () => {
    mockedPrisma.user.findMany.mockResolvedValue([{ id: "user-1" }] as never);
    mockedPrisma.notification.create.mockResolvedValue({ id: "notif-1" } as never);

    const result = await sendNotification(
      schoolId,
      {
        title: "Announcement",
        body: "Hello",
        priority: "LOW",
        targetType: "ENTIRE_SCHOOL",
      },
      "admin-1"
    );

    expect(result.notification).toMatchObject({ id: "notif-1" });
    expect(mockedPrisma.notificationRecipient.createMany).toHaveBeenCalled();
  });

  it("targets a class", async () => {
    mockedPrisma.studentEnrollment.findMany.mockResolvedValue([
      { student: { userId: "user-1" } },
    ] as never);
    mockedPrisma.notification.create.mockResolvedValue({ id: "notif-1" } as never);

    await sendNotification(schoolId, {
      title: "Class Update",
      body: "Details",
      priority: "LOW",
      targetType: "CLASS",
      classId: "11111111-1111-1111-8111-111111111111",
    });

    expect(mockedPrisma.notificationRecipient.createMany).toHaveBeenCalled();
  });

  it("targets a section", async () => {
    mockedPrisma.studentEnrollment.findMany.mockResolvedValue([
      { student: { userId: "user-1" } },
    ] as never);
    mockedPrisma.notification.create.mockResolvedValue({ id: "notif-1" } as never);

    await sendNotification(schoolId, {
      title: "Section Update",
      body: "Details",
      priority: "LOW",
      targetType: "SECTION",
      sectionId: "22222222-2222-2222-8222-222222222222",
    });

    expect(mockedPrisma.notificationRecipient.createMany).toHaveBeenCalled();
  });

  it("targets all teachers", async () => {
    mockedPrisma.user.findMany.mockResolvedValue([{ id: "user-1" }] as never);
    mockedPrisma.notification.create.mockResolvedValue({ id: "notif-1" } as never);

    await sendNotification(schoolId, {
      title: "Teacher Update",
      body: "Details",
      priority: "LOW",
      targetType: "ALL_TEACHERS",
    });

    expect(mockedPrisma.user.findMany).toHaveBeenCalled();
  });

  it("uses delivery channels based on priority", async () => {
    mockedPrisma.user.findMany.mockResolvedValue([{ id: "user-1" }] as never);
    mockedPrisma.notification.create.mockResolvedValue({ id: "notif-1" } as never);

    await sendNotification(schoolId, {
      title: "High",
      body: "Details",
      priority: "HIGH",
      targetType: "ENTIRE_SCHOOL",
    });

    expect(mockedPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sentVia: ["PUSH", "SMS"],
        }),
      })
    );
  });
});
