import { Queue, Worker } from "bullmq";

import { getRedis } from "@/core/redis";
import { getJobQueue } from "@/core/queue/queue";
import { getNotificationQueue } from "@/core/queue/notificationBullmq";
import { createBullMQConnection } from "@/core/queue/redisBullmq";
import prisma from "@/core/db/prisma";
import { withTimeout } from "@/core/utils/timeout";
import { withConsoleTime } from "@/core/utils/perf";
import { sendPush } from "@/core/push/pushProvider";
import {
  aggregateNotificationDelivery,
  cleanupPushTokens,
  deliverQueuedNotification,
  markNotificationDeliveryFailed,
} from "@/services/notificationService";
import { publishResults, recomputeResults } from "@/modules/results/service";
import { recomputeRanking } from "@/modules/ranking/service";
import { bulkGeneratePDFs, generateAdmitCardsForExam } from "@/modules/admitCards/service";
import { generateReportCardPdf } from "@/modules/reportCards/service";
import { checkAndSendAssignmentReminders } from "@/modules/assignments/service";
import type { JobPayload } from "@/core/queue/types";

const rawConcurrency = Number(process.env.JOB_CONCURRENCY ?? 20);
const concurrency = Math.min(Math.max(rawConcurrency, 1), 50);
const queueMetricsIntervalMs = Number(process.env.QUEUE_METRICS_INTERVAL_MS ?? 30_000);

let jobWorker: Worker | null = null;
let notificationWorker: Worker | null = null;
let notificationDlqQueue: Queue | null = null;

export async function getJobWorker() {
  if (jobWorker) {
    return jobWorker;
  }

  const redis = await getRedis();
  if (!redis) {
    return null;
  }

  let connection;
  try {
    connection = createBullMQConnection();
  } catch (err) {
    console.error("[queue] BullMQ connection init failed", err);
    return null;
  }

  jobWorker = new Worker(
    "saiyonix-jobs",
    async (job) => {
      const payload = job.data as JobPayload;
      console.log(`[job:start] ${job.name} ${job.id}`);

      try {
        switch (payload.type) {
          case "RESULTS_RECOMPUTE":
            await withConsoleTime(`job:results:${payload.examId}`, async () =>
              withTimeout(
                recomputeResults(payload.schoolId, payload.examId, {
                  userId: "SYSTEM",
                  roleType: "ADMIN",
                }),
                60_000,
                "Results recompute"
              )
            );
            break;
          case "RESULTS_PUBLISH":
            await withConsoleTime(`job:results-publish:${payload.examId}`, async () =>
              withTimeout(
                publishResults(payload.schoolId, payload.examId, payload.actor),
                120_000,
                "Results publish"
              )
            );
            break;
          case "RANKING_RECOMPUTE":
            await withConsoleTime(`job:ranking:${payload.examId}`, async () =>
              withTimeout(
                recomputeRanking(payload.schoolId, payload.examId, {
                  userId: "SYSTEM",
                  roleType: "ADMIN",
                }),
                60_000,
                "Ranking recompute"
              )
            );
            break;
          case "ADMIT_CARD_GENERATE":
            await withConsoleTime(`job:admit:${payload.examId}`, async () =>
              withTimeout(
                generateAdmitCardsForExam(payload.schoolId, payload.examId),
                60_000,
                "Admit card generation"
              )
            );
            break;
          case "ADMIT_CARD_PDF_GENERATE":
            await withConsoleTime(`job:admit-pdf:${payload.examId}`, async () =>
              withTimeout(
                bulkGeneratePDFs(payload.schoolId, payload.examId),
                120_000,
                "Admit card PDF generation"
              )
            );
            break;
          case "REPORT_CARD_PDF_GENERATE":
            await withConsoleTime(
              `job:report-card-pdf:${payload.examId}:${payload.studentId}`,
              async () =>
                withTimeout(
                  generateReportCardPdf(payload.schoolId, payload.examId, payload.studentId),
                  120_000,
                  "Report card PDF generation"
                )
            );
            break;
          case "ASSIGNMENT_REMINDER":
            await withConsoleTime(`job:assignment-reminder:${payload.schoolId}`, async () =>
              withTimeout(
                checkAndSendAssignmentReminders(payload.schoolId),
                30_000,
                "Assignment reminders"
              )
            );
            break;
          case "NOTIFICATION_MONITOR":
            await withConsoleTime(`job:notification-monitor:${payload.schoolId}`, async () => {
              const summary = await aggregateNotificationDelivery({
                schoolId: payload.schoolId,
                windowMinutes: 5,
              });
              const pct = Math.round(summary.failureRate * 1000) / 10;
              const line = `[NOTIFICATION_MONITOR] school=${payload.schoolId} since=${summary.since} sent=${summary.sent} failed=${summary.failed} invalid=${summary.invalid} total=${summary.total} failedPct=${pct}%`;
              if (summary.total >= 20 && summary.failureRate > 0.2) {
                console.error(`[CRITICAL] ${line}`);
                try {
                  const prismaAny = prisma as any;
                  await prismaAny.systemAlert.create({
                    data: {
                      type: "NOTIFICATION_FAILURE",
                      severity: "CRITICAL",
                      schoolId: payload.schoolId,
                      message: line,
                    },
                  });
                } catch (error) {
                  console.error("[NOTIFICATION_MONITOR] alert persist failed", error);
                }
              } else {
                console.log(line);
              }
            });
            break;
          case "PUSH_TOKEN_CLEANUP":
            await withConsoleTime(`job:push-token-cleanup:${payload.schoolId}`, async () =>
              withTimeout(cleanupPushTokens({ schoolId: payload.schoolId }), 30_000, "Push token cleanup")
            );
            break;
          default:
            break;
        }

        console.log(`[job:success] ${job.name} ${job.id}`);
      } catch (error) {
        console.error(`[job:fail] ${job.name} ${job.id}`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency,
      lockDuration: 60_000,
    }
  );
  void jobWorker.client?.then((client) => client.on("error", () => {})).catch(() => {});

  console.log(`[job:worker] concurrency=${concurrency}`);

  jobWorker.on("failed", (job, err) => {
    const durationMs =
      job?.processedOn && job?.finishedOn ? job.finishedOn - job.processedOn : undefined;
    console.error(
      `[job:fail] ${job?.name} ${job?.id} attempts=${job?.attemptsMade} durationMs=${
        durationMs ?? "n/a"
      }`,
      err
    );
  });

  jobWorker.on("error", (err) => {
    console.error("[job:error]", err);
  });

  jobWorker.on("stalled", (jobId) => {
    console.warn(`[job:stalled] ${jobId}`);
  });

  jobWorker.on("completed", (job) => {
    const durationMs =
      job?.processedOn && job?.finishedOn ? job.finishedOn - job.processedOn : undefined;
    console.log(
      `[job:duration] ${job?.name} ${job?.id} durationMs=${durationMs ?? "n/a"}`
    );
  });

  setInterval(async () => {
    try {
      const queue = await getJobQueue();
      if (!(queue instanceof Queue)) return;
      const counts = await queue.getJobCounts("waiting", "active", "delayed", "failed");
      console.log(
        `[queue:stats] waiting=${counts.waiting} active=${counts.active} delayed=${counts.delayed} failed=${counts.failed}`
      );
    } catch (error) {
      console.error("[queue:stats:error]", error);
    }
  }, queueMetricsIntervalMs).unref();

  return jobWorker;
}

export async function getNotificationWorker() {
  if (notificationWorker) {
    return notificationWorker;
  }

  const redis = await getRedis();
  if (!redis) {
    return null;
  }

  let connection;
  try {
    connection = createBullMQConnection();
  } catch (err) {
    console.error("[queue] BullMQ connection init failed", err);
    return null;
  }

  if (!notificationDlqQueue) {
    notificationDlqQueue = new Queue("notification-dlq", {
      connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
    });
  }

  notificationWorker = new Worker(
    "notification",
    async (job) => {
      try {
        if (job.name === "deliver-notification") {
          const data = job.data as { notificationId?: string };
          const notificationId =
            typeof data?.notificationId === "string" ? data.notificationId.trim() : "";

          console.log(
            `[notification-worker:received] name=${job.name} id=${job.id} notificationId=${notificationId || "n/a"}`
          );

          if (!notificationId) {
            throw new Error("notificationId is required for deliver-notification");
          }

          await deliverQueuedNotification({ notificationId });

          console.log(
            `[notification-worker:processed] name=${job.name} id=${job.id} notificationId=${notificationId}`
          );
          return;
        }

        if (job.name !== "notify") {
          console.log(`[notification-worker:ignored] name=${job.name} id=${job.id}`);
          return;
        }

        const data = job.data as {
          notificationId?: string;
          userId?: string;
          userIds?: string[];
          message?: string;
          title?: string;
          body?: string;
          schoolId?: string;
        };

        if (typeof data.notificationId === "string" && data.notificationId.trim().length > 0) {
          console.log(
            `[notification-worker:received] name=${job.name} id=${job.id} notificationId=${data.notificationId.trim()}`
          );
          await deliverQueuedNotification({ notificationId: data.notificationId });
          console.log(
            `[notification-worker:processed] name=${job.name} id=${job.id} notificationId=${data.notificationId.trim()}`
          );
          return;
        }

        const users = data.userIds ?? (data.userId ? [data.userId] : []);
        const validUsers = (users || []).filter(
          (id) => typeof id === "string" && id.trim().length > 0
        );
        const message = data.message ?? data.body ?? "";
        const title = data.title ?? "Notification";
        const schoolId = data.schoolId;

        if (!validUsers.length || !schoolId) {
          console.warn("[notification-worker] No valid users or schoolId, skipping legacy job");
          return;
        }

        console.log(
          `[notification-worker:received] name=${job.name} id=${job.id} users=${validUsers.length} schoolId=${schoolId}`
        );
        await sendPush({
          schoolId,
          userIds: validUsers,
          title,
          body: message,
        });
        console.log(
          `[notification-worker:processed] name=${job.name} id=${job.id} users=${validUsers.length} schoolId=${schoolId}`
        );
      } catch (err) {
        console.error("[notification-worker] handler error", err);
        throw err;
      }
    },
    { connection }
  );
  void notificationWorker.client?.then((client) => client.on("error", () => {})).catch(() => {});

  notificationWorker.on("error", (err) => {
    console.error("[notification-worker] error", err);
  });

  notificationWorker.on("failed", async (job, err) => {
    try {
      if (!job) return;
      const data = job.data as { notificationId?: string };
      const maxAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
      const isFinalFailure = (job.attemptsMade ?? 0) >= maxAttempts;

      if (data?.notificationId && isFinalFailure) {
        try {
          await notificationDlqQueue?.add(
            "FAILED_NOTIFICATION",
            {
              notificationId: data.notificationId,
              error: err instanceof Error ? err.message : String(err),
            },
            {
              attempts: 1,
              removeOnComplete: false,
              removeOnFail: false,
            }
          );
        } catch (dlqError) {
          console.error("[notification-worker] dlq enqueue error", dlqError);
        }

        await markNotificationDeliveryFailed(
          data.notificationId,
          err instanceof Error ? err.message : String(err)
        );
      }
    } catch (error) {
      console.error("[notification-worker] failed handler error", error);
    }
  });

  return notificationWorker;
}

export async function startQueueWorkers() {
  try {
    console.log("[queue] Worker enabled:", process.env.WORKER_ENABLED);
    if (process.env.WORKER_ENABLED !== "true") {
      console.log("[queue] Worker disabled by env");
      return;
    }
  } catch (err) {
    console.error("[queue] Worker env check failed", err);
    return;
  }

  try {
    void getNotificationQueue();
  } catch (err) {
    console.error("[queue] notification queue init failed", err);
  }
  try {
    void getJobWorker();
  } catch (err) {
    console.error("[queue] job worker init failed", err);
  }
  try {
    void getNotificationWorker();
  } catch (err) {
    console.error("[queue] notification worker init failed", err);
  }
}
