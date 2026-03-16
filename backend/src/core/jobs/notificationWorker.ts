import { Prisma } from "@prisma/client";

import prisma from "../db/prisma";
import { sendPush } from "../push/pushProvider";
import { logger } from "../../utils/logger";

type PushJobPayload = {
  type: "PUSH";
  payload: {
    schoolId: string;
    userIds: string[];
    title: string;
    body: string;
    data?: Record<string, unknown> | null;
  };
  attempts?: number;
  maxAttempts?: number;
  lastError?: string | null;
};

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_CLEANUP_DAYS = 7;

type WorkerStatus = {
  status: "stopped" | "running" | "disabled" | "error";
  lastError: string | null;
  lastRunAt: string | null;
};

const workerStatus: WorkerStatus = {
  status: "stopped",
  lastError: null,
  lastRunAt: null,
};

export function getNotificationWorkerStatus() {
  return { ...workerStatus };
}

export function markNotificationWorkerDisabled() {
  setWorkerStatus("disabled");
}

function setWorkerStatus(status: WorkerStatus["status"], error?: unknown) {
  workerStatus.status = status;
  workerStatus.lastRunAt = new Date().toISOString();
  if (error) {
    workerStatus.lastError = error instanceof Error ? error.message : String(error);
  }
}

function getBackoffDelay(attempts: number) {
  const index = Math.max(0, attempts - 1);
  return DEFAULT_BACKOFF_MS[Math.min(index, DEFAULT_BACKOFF_MS.length - 1)];
}

function getNextAttemptAt(attempts: number) {
  return new Date(Date.now() + getBackoffDelay(attempts));
}

function toPushPayload(raw: unknown): PushJobPayload | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const payload = raw as PushJobPayload;
  if (payload.type !== "PUSH" || !payload.payload) {
    return null;
  }

  return payload;
}

async function claimNextJob() {
  const candidates = await prisma.$queryRaw<
    Array<{
      id: string;
      schoolId: string;
      idempotencyKey: string;
      status: string;
      payload: Prisma.JsonValue;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(
    Prisma.sql`
      SELECT
        "id",
        "schoolId",
        "idempotencyKey",
        "status",
        "payload",
        "createdAt",
        "updatedAt"
      FROM "NotificationJob"
      WHERE "status" = 'PENDING'
        AND (
          ("payload"->>'nextAttemptAt') IS NULL
          OR ("payload"->>'nextAttemptAt')::timestamptz <= NOW()
        )
      ORDER BY "createdAt" ASC
      LIMIT 20
    `
  );

  if (candidates.length === 0) {
    return null;
  }
  const job = candidates[0];

  const result = await prisma.notificationJob.updateMany({
    where: { id: job.id, status: "PENDING" },
    data: { status: "PROCESSING" },
  });

  if (result.count === 0) {
    return null;
  }

  return job;
}

async function handleFailure(jobId: string, payload: PushJobPayload, error: unknown) {
  const attempts = (payload.attempts ?? 0) + 1;
  const maxAttempts = payload.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const lastError = error instanceof Error ? error.message : String(error);

  const nextStatus = attempts >= maxAttempts ? "FAILED" : "PENDING";
  const nextAttemptAt =
    nextStatus === "PENDING" ? getNextAttemptAt(attempts).toISOString() : null;

  await prisma.notificationJob.update({
    where: { id: jobId },
    data: {
      status: nextStatus,
      payload: {
        ...payload,
        attempts,
        maxAttempts,
        lastError,
        nextAttemptAt,
      } as Prisma.InputJsonValue,
    },
  });

  if (nextStatus === "FAILED") {
    logger.warn(`[NOTIFICATION_WORKER] job=${jobId} failed permanently: ${lastError}`);
  }
}

export async function processNextNotificationJob() {
  const job = await claimNextJob();
  if (!job) {
    return null;
  }

  const payload = toPushPayload(job.payload);
  if (!payload) {
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: { status: "FAILED", payload: job.payload as Prisma.InputJsonValue },
    });
    logger.warn(`[NOTIFICATION_WORKER] job=${job.id} invalid payload`);
    return job;
  }

  try {
    await sendPush(payload.payload);
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        payload: {
          ...payload,
          attempts: (payload.attempts ?? 0) + 1,
          lastError: null,
          nextAttemptAt: null,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    await handleFailure(job.id, payload, error);
  }

  return job;
}

export async function processPendingNotificationJobs(limit = 10) {
  let processed = 0;
  while (processed < limit) {
    const job = await processNextNotificationJob();
    if (!job) {
      break;
    }
    processed += 1;
  }

  return processed;
}

async function cleanupFailedJobs(retentionDays: number) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  await prisma.notificationJob.deleteMany({
    where: { status: "FAILED", updatedAt: { lt: cutoff } },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function startNotificationWorker(options?: {
  intervalMs?: number;
  batchSize?: number;
  cleanupDays?: number;
}) {
  const intervalMs = options?.intervalMs ?? 2000;
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const cleanupDays = options?.cleanupDays ?? DEFAULT_CLEANUP_DAYS;
  let stopped = false;
  let lastCleanup = 0;

  const run = async () => {
    setWorkerStatus("running");
    while (!stopped) {
      try {
        const processed = await processPendingNotificationJobs(batchSize);
        const now = Date.now();
        if (now - lastCleanup > 60 * 60 * 1000) {
          await cleanupFailedJobs(cleanupDays);
          lastCleanup = now;
        }

        if (processed === 0) {
          await sleep(intervalMs);
        }
      } catch (error) {
        setWorkerStatus("error", error);
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`[NOTIFICATION_WORKER] ${message}`);
        await sleep(intervalMs);
      }
    }

    setWorkerStatus("stopped");
  };

  void run();

  return () => {
    stopped = true;
  };
}
