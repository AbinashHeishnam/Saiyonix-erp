import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import prisma from "../db/prisma";

export type NotificationJobStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type NotificationQueuePayload = {
  schoolId: string;
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
};

export type NotificationQueueResult = {
  attempts: number;
  success: boolean;
};

export type NotificationQueueOptions = {
  maxAttempts?: number;
};

export async function enqueueNotificationJob(
  payload: NotificationQueuePayload,
  options?: NotificationQueueOptions
): Promise<NotificationQueueResult> {
  const maxAttempts = options?.maxAttempts ?? 3;

  const jobPayload = {
    type: "PUSH",
    payload: {
      ...payload,
      data: payload.data ?? null,
    },
    attempts: 0,
    maxAttempts,
  } as Prisma.InputJsonValue;

  await prisma.notificationJob.create({
    data: {
      schoolId: payload.schoolId,
      idempotencyKey: `push-${uuidv4()}`,
      status: "PENDING",
      payload: jobPayload,
    },
  });

  return { attempts: 0, success: true };
}

export async function listDeadLetterJobs(limit = 50) {
  const jobs = await prisma.notificationJob.findMany({
    where: { status: "FAILED" },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      payload: true,
      updatedAt: true,
    },
  });

  return jobs;
}
