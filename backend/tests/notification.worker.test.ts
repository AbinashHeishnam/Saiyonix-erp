import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

vi.mock("../src/core/push/pushProvider", () => ({
  sendPush: vi.fn(),
}));

import prisma from "../src/config/prisma";
import { sendPush } from "../src/core/push/pushProvider";
import { processNextNotificationJob } from "../src/core/jobs/notificationWorker";

const mockedPrisma = vi.mocked(prisma, true);
const mockedSendPush = vi.mocked(sendPush);

describe("notification worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes pending push jobs", async () => {
    mockedPrisma.$queryRaw.mockResolvedValue([
      {
        id: "job-1",
        status: "PENDING",
        payload: {
          type: "PUSH",
          payload: {
            schoolId: "school-1",
            userIds: ["user-1"],
            title: "Hello",
            body: "World",
          },
          attempts: 0,
          maxAttempts: 2,
        },
      },
    ] as never);
    mockedPrisma.notificationJob.updateMany.mockResolvedValue({ count: 1 } as never);
    mockedPrisma.notificationJob.update.mockResolvedValue({ id: "job-1" } as never);
    mockedSendPush.mockResolvedValue();

    await processNextNotificationJob();

    expect(mockedSendPush).toHaveBeenCalled();
    expect(mockedPrisma.notificationJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      })
    );
  });

  it("retries failed jobs until max attempts", async () => {
    mockedPrisma.$queryRaw.mockResolvedValue([
      {
        id: "job-2",
        status: "PENDING",
        payload: {
          type: "PUSH",
          payload: {
            schoolId: "school-1",
            userIds: ["user-1"],
            title: "Hello",
            body: "World",
          },
          attempts: 0,
          maxAttempts: 2,
        },
      },
    ] as never);
    mockedPrisma.notificationJob.updateMany.mockResolvedValue({ count: 1 } as never);
    mockedPrisma.notificationJob.update.mockResolvedValue({ id: "job-2" } as never);
    mockedSendPush.mockRejectedValue(new Error("push failed"));

    await processNextNotificationJob();

    expect(mockedPrisma.notificationJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING" }),
      })
    );
  });

  it("moves jobs to failed after max attempts", async () => {
    mockedPrisma.$queryRaw.mockResolvedValue([
      {
        id: "job-3",
        status: "PENDING",
        payload: {
          type: "PUSH",
          payload: {
            schoolId: "school-1",
            userIds: ["user-1"],
            title: "Hello",
            body: "World",
          },
          attempts: 0,
          maxAttempts: 1,
        },
      },
    ] as never);
    mockedPrisma.notificationJob.updateMany.mockResolvedValue({ count: 1 } as never);
    mockedPrisma.notificationJob.update.mockResolvedValue({ id: "job-3" } as never);
    mockedSendPush.mockRejectedValue(new Error("push failed"));

    await processNextNotificationJob();

    expect(mockedPrisma.notificationJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
  });
});
