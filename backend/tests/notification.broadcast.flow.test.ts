import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

vi.mock("../src/modules/notification/resolvers", () => ({
  resolveRecipients: vi.fn(),
}));

vi.mock("../src/core/queue/notificationQueue", () => ({
  enqueueNotificationJob: vi.fn(),
}));

import prisma from "../src/config/prisma";
import { enqueueNotificationJob } from "../src/core/queue/notificationQueue";
import { resolveRecipients } from "../src/modules/notification/resolvers";
import { sendNotification } from "../src/modules/notification/service";

const mockedPrisma = vi.mocked(prisma, true);
const mockedResolveRecipients = vi.mocked(resolveRecipients);
const mockedEnqueue = vi.mocked(enqueueNotificationJob);

const schoolId = "school-1";

function setupTransaction() {
  mockedPrisma.$transaction.mockImplementation(async (input) => {
    if (Array.isArray(input)) {
      return Promise.all(input);
    }
    return input({
      notification: mockedPrisma.notification,
      notificationRecipient: mockedPrisma.notificationRecipient,
    } as never);
  });
}

describe("notification broadcast flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTransaction();

    mockedResolveRecipients.mockResolvedValue(["user-1"] as never);
    mockedPrisma.notification.create.mockResolvedValue({ id: "notif-1" } as never);
    mockedPrisma.notificationRecipient.createMany.mockResolvedValue({ count: 1 } as never);
    mockedEnqueue.mockResolvedValue({ attempts: 1, success: true } as never);
  });

  it("enqueues push delivery for broadcast notifications", async () => {
    const result = await sendNotification(
      schoolId,
      {
        title: "Announcement",
        body: "Hello",
        priority: "HIGH",
        targetType: "ENTIRE_SCHOOL",
      },
      "admin-1"
    );

    expect(result.notification).toMatchObject({ id: "notif-1" });
    expect(mockedEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId,
        userIds: ["user-1"],
        title: "Announcement",
        body: "Hello",
      })
    );
  });
});
