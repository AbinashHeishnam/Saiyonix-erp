import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

vi.mock("../src/modules/notification/resolvers", () => ({
  resolveRecipients: vi.fn(),
}));

import prisma from "../src/config/prisma";
import { resolveRecipients } from "../src/modules/notification/resolvers";
import { sendNotification } from "../src/modules/notification/service";

const mockedPrisma = vi.mocked(prisma, true);
const mockedResolveRecipients = vi.mocked(resolveRecipients);

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

describe("notification idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTransaction();

    mockedResolveRecipients.mockResolvedValue(["user-1", "user-2"] as never);
    mockedPrisma.notification.create.mockResolvedValue({ id: "notif-1" } as never);
    mockedPrisma.notificationRecipient.createMany.mockResolvedValue({ count: 2 } as never);
  });

  it("first request creates job", async () => {
    mockedPrisma.notificationJob.create.mockResolvedValue({ id: "job-1" } as never);

    await sendNotification(
      schoolId,
      {
        title: "Test",
        body: "Hello",
        priority: "LOW",
        targetType: "ALL_STUDENTS",
      },
      "admin-1",
      "idem-1"
    );

    expect(mockedPrisma.notificationJob.create).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.notificationJob.update).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.notification.create).toHaveBeenCalledTimes(1);
  });

  it("duplicate request returns same job", async () => {
    mockedPrisma.notificationJob.create.mockRejectedValue({ code: "P2002" } as never);
    mockedPrisma.notificationJob.findUnique.mockResolvedValue({
      id: "job-1",
      schoolId,
      payload: {
        result: { notification: { id: "notif-1" }, recipientCount: 2 },
      },
    } as never);

    const result = await sendNotification(
      schoolId,
      {
        title: "Test",
        body: "Hello",
        priority: "LOW",
        targetType: "ALL_STUDENTS",
      },
      "admin-1",
      "idem-1"
    );

    expect(result).toMatchObject({
      notification: { id: "notif-1" },
      recipientCount: 2,
    });
    expect(mockedPrisma.notification.create).not.toHaveBeenCalled();
  });

  it("notifications not duplicated", async () => {
    mockedPrisma.notificationJob.create
      .mockResolvedValueOnce({ id: "job-1" } as never)
      .mockRejectedValueOnce({ code: "P2002" } as never);
    mockedPrisma.notificationJob.findUnique.mockResolvedValue({
      id: "job-1",
      schoolId,
      payload: {
        result: { notification: { id: "notif-1" }, recipientCount: 2 },
      },
    } as never);

    await sendNotification(
      schoolId,
      {
        title: "Test",
        body: "Hello",
        priority: "LOW",
        targetType: "ALL_STUDENTS",
      },
      "admin-1",
      "idem-1"
    );

    await sendNotification(
      schoolId,
      {
        title: "Test",
        body: "Hello",
        priority: "LOW",
        targetType: "ALL_STUDENTS",
      },
      "admin-1",
      "idem-1"
    );

    expect(mockedPrisma.notification.create).toHaveBeenCalledTimes(1);
  });
});
