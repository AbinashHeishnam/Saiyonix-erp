import {
  Expo,
  type ExpoPushMessage,
  type ExpoPushSuccessTicket,
  type ExpoPushTicket,
} from "expo-server-sdk";
import {
  Prisma,
  type Notification as NotificationModel,
  type NotificationLogStatus,
  type NotificationRecipient as NotificationRecipientModel,
  type PushPlatform,
} from "@prisma/client";
import pLimit from "p-limit";

import { env } from "@/config/env";
import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { getRedis } from "@/core/redis";
import { getNotificationQueue } from "@/core/queue/notificationBullmq";
import { getFirebaseMessaging } from "@/integrations/firebase";
import { logger } from "@/utils/logger";

type RegisterTokenInput = {
  schoolId: string;
  userId: string;
  token: string;
  projectId?: string;
  platform: PushPlatform;
  deviceInfo?: Prisma.InputJsonValue;
};

type RemoveTokenInput = {
  schoolId: string;
  userId: string;
  token: string;
};

type DeliveryJobPayload = {
  notificationId: string;
};

type StoredNotification = Prisma.NotificationGetPayload<{
  include: {
    recipients: {
      include: {
        user: {
          select: {
            id: true;
            pushTokens: {
              where: {
                invalidatedAt: null;
              };
              select: {
                id: true;
                token: true;
                platform: true;
                projectId: true;
                deviceInfo: true;
              };
            };
          };
        };
      };
    };
  };
}>;

const expoClient = new Expo({
  accessToken: env.EXPO_ACCESS_TOKEN,
  useFcmV1: true,
});

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Push timeout")), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }) as Promise<T>;
}


function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getNotificationType(
  notification: Pick<NotificationModel, "type"> & {
    category?: NotificationModel["category"];
    eventType?: NotificationModel["eventType"];
  }
) {
  if (notification.type) {
    return String(notification.type).toLowerCase();
  }

  if (notification.category?.toUpperCase() === "NOTICE") {
    return "notice";
  }

  if (notification.eventType?.includes("ATTENDANCE")) {
    return "attendance";
  }

  return "general";
}

function getChannels(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.toUpperCase());
}

function buildDeliveryPayload(
  notification: Pick<
    NotificationModel,
    "id" | "title" | "body" | "linkUrl" | "entityId" | "entityType" | "eventType" | "type" | "data" | "metadata"
  >,
  recipient: Pick<NotificationRecipientModel, "id" | "userId">
) {
  return {
    notificationId: notification.id,
    recipientId: recipient.id,
    type: getNotificationType(notification),
    title: notification.title,
    message: notification.body,
    linkUrl:
      notification.linkUrl ??
      (getNotificationType(notification) === "attendance"
        ? "/attendance"
        : getNotificationType(notification) === "notice"
          ? "/notices"
          : "/notifications"),
    entityId: notification.entityId ?? null,
    entityType: notification.entityType ?? null,
    eventType: notification.eventType ?? null,
  };
}

function toFcmData(payload: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      out[key] = value;
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      out[key] = String(value);
      continue;
    }
    try {
      out[key] = JSON.stringify(value);
    } catch {
      // Skip non-serializable values.
    }
  }
  return out;
}

function classifyFcmErrorCode(code: string | null | undefined) {
  const c = (code ?? "").toLowerCase();
  const invalid =
    c.includes("registration-token-not-registered") ||
    c.includes("invalid-registration-token") ||
    c.includes("invalid-argument");

  const rateLimited = c.includes("message-rate-exceeded") || c.includes("quota-exceeded");
  const unavailable = c.includes("server-unavailable") || c.includes("internal") || c.includes("unavailable");

  return {
    invalid,
    transient: !invalid && (rateLimited || unavailable),
  };
}

async function invalidateToken(pushTokenId: string, reason: string) {
  await prisma.pushToken.update({
    where: { id: pushTokenId },
    data: { invalidatedAt: new Date() },
  });
  logger.warn(`[NOTIFICATION] invalidated push token ${pushTokenId}: ${reason}`);
}

async function createLog(params: {
  schoolId: string;
  notificationId: string;
  recipientId?: string;
  userId?: string;
  pushTokenId?: string;
  channel: "MOBILE_PUSH" | "WEB_PUSH" | "IN_APP";
  platform?: PushPlatform;
  status: NotificationLogStatus;
  providerMessageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  attemptCount?: number;
  deliveredAt?: Date | null;
}) {
  await prisma.notificationLog.create({
    data: {
      schoolId: params.schoolId,
      notificationId: params.notificationId,
      notificationRecipientId: params.recipientId ?? null,
      userId: params.userId ?? null,
      pushTokenId: params.pushTokenId ?? null,
      channel: params.channel,
      platform: params.platform,
      status: params.status,
      providerMessageId: params.providerMessageId ?? null,
      errorCode: params.errorCode ?? null,
      errorMessage: params.errorMessage ?? null,
      attemptCount: params.attemptCount ?? 1,
      deliveredAt: params.deliveredAt ?? null,
    },
  });
}

async function markRecipientStatus(recipientId: string, status: string) {
  await prisma.notificationRecipient.update({
    where: { id: recipientId },
    data: { deliveryStatus: status },
  });
}

async function fetchNotification(notificationId: string) {
  return prisma.notification.findUnique({
    where: { id: notificationId },
    include: {
      recipients: {
        include: {
          user: {
            select: {
              id: true,
              pushTokens: {
                where: {
                  invalidatedAt: null,
                },
                select: {
                  id: true,
                  token: true,
                  platform: true,
                  projectId: true,
                  deviceInfo: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function registerPushToken(input: RegisterTokenInput) {
  const now = new Date();
  const token = input.token.trim();
  const rawProjectId = typeof input.projectId === "string" ? input.projectId.trim() : null;
  if (!token) {
    throw new ApiError(400, "Push token is required");
  }
  const isExpoToken = Expo.isExpoPushToken(token);
  if (input.platform === "EXPO" && !isExpoToken) {
    throw new ApiError(400, "Invalid Expo push token");
  }
  const platform: PushPlatform = isExpoToken ? "EXPO" : input.platform;
  const projectId = platform === "EXPO" ? rawProjectId : null;
  if (platform === "EXPO" && !projectId) {
    throw new ApiError(400, "projectId is required for Expo tokens");
  }

  const select = {
    id: true,
    token: true,
    platform: true,
    projectId: true,
    createdAt: true,
    updatedAt: true,
    lastSeenAt: true,
    invalidatedAt: true,
  } as const;

  const stored = await prisma.pushToken.upsert({
    where: { userId_token: { userId: input.userId, token } },
    update: {
      schoolId: input.schoolId,
      userId: input.userId,
      invalidatedAt: null,
      platform,
      projectId,
      deviceInfo: input.deviceInfo,
      lastSeenAt: now,
    },
    create: {
      schoolId: input.schoolId,
      userId: input.userId,
      token,
      platform,
      projectId,
      deviceInfo: input.deviceInfo,
      invalidatedAt: null,
      lastSeenAt: now,
    },
    select,
  });

  try {
    const activeCount = await prisma.pushToken.count({
      where: { userId: input.userId, invalidatedAt: null, platform: "EXPO" },
    });
    logger.info(
      `[PUSH_TOKEN] stored user=${input.userId} school=${input.schoolId} platform=${stored.platform} activeExpoTokens=${activeCount} token=${token.slice(
        0,
        8
      )}…`
    );
  } catch (logError) {
    logger.warn("[PUSH_TOKEN] stored (failed to compute active count)", logError);
  }

  return stored;
}

export async function removePushToken(input: RemoveTokenInput) {
  const result = await prisma.pushToken.deleteMany({
    where: {
      schoolId: input.schoolId,
      userId: input.userId,
      token: input.token,
    },
  });

  return { removed: result.count };
}

export async function queueNotificationDelivery(notificationId: string) {
  console.log("🔥 QUEUE FUNCTION CALLED", notificationId);
  logger.info(`[trace] 🔥 QUEUE FUNCTION CALLED notificationId=${notificationId}`);
  console.log("[QUEUE] called", notificationId);
  const queue = await getNotificationQueue();
  console.log("[QUEUE] instance =", !!queue);
  logger.info(`[trace] queue instance=${queue ? "true" : "false"} notificationId=${notificationId}`);
  if (!queue) {
    await deliverQueuedNotification({ notificationId });
    return { queued: false };
  }

  console.log("🔥 ADDING JOB TO QUEUE");
  logger.info(`[trace] 🔥 ADDING JOB TO QUEUE notificationId=${notificationId}`);
  console.log("[QUEUE] adding job");
  await queue.add("deliver-notification", { notificationId } satisfies DeliveryJobPayload, {
    jobId: `notif_${notificationId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
  console.log("[QUEUE] job added");
  logger.info(`[trace] job added name=deliver-notification notificationId=${notificationId}`);

  return { queued: true };
}

export async function deliverQueuedNotification(job: DeliveryJobPayload) {
  const notification = await fetchNotification(job.notificationId);
  if (!notification) {
    logger.warn(`[NOTIFICATION] notification ${job.notificationId} not found for delivery`);
    return { deliveredRecipients: 0 };
  }

  const channels = getChannels(notification.sentVia);
  const wantsPush = channels.includes("PUSH") || channels.includes("MOBILE_PUSH") || channels.includes("WEB_PUSH");
  const recipients = notification.recipients ?? [];

  const sentLogs = await prisma.notificationLog.findMany({
    where: {
      notificationId: notification.id,
      status: "SENT",
      channel: { in: ["MOBILE_PUSH", "WEB_PUSH"] },
      pushTokenId: { not: null },
    },
    select: { pushTokenId: true, channel: true },
  });

  const alreadySentExpo = new Set<string>();
  const alreadySentFcm = new Set<string>();
  for (const log of sentLogs) {
    if (!log.pushTokenId) continue;
    if (log.channel === "MOBILE_PUSH") alreadySentExpo.add(log.pushTokenId);
    if (log.channel === "WEB_PUSH") alreadySentFcm.add(log.pushTokenId);
  }

  if (!wantsPush) {
    await prisma.notificationRecipient.updateMany({
      where: { notificationId: notification.id },
      data: { deliveryStatus: "DELIVERED" },
    });
    return { deliveredRecipients: recipients.length };
  }

  type RecipientStats = {
    hadActiveToken: boolean;
    hadSentPreviously: boolean;
    sent: number;
    failed: number;
    invalid: number;
    skipped: number;
  };

  const byRecipient = new Map<string, RecipientStats>();
  const getStats = (recipientId: string) => {
    const existing = byRecipient.get(recipientId);
    if (existing) return existing;
    const next: RecipientStats = {
      hadActiveToken: false,
      hadSentPreviously: false,
      sent: 0,
      failed: 0,
      invalid: 0,
      skipped: 0,
    };
    byRecipient.set(recipientId, next);
    return next;
  };

  const expoItems: Array<{
    pushTokenId: string;
    expoToken: string;
    projectId: string | null;
    recipientId: string;
    userId: string;
    data: Record<string, unknown>;
    deviceInfo: Prisma.InputJsonValue | null;
  }> = [];

  const fcmGroups: Array<{
    recipientId: string;
    userId: string;
    tokens: Array<{ pushTokenId: string; token: string }>;
    data: Record<string, unknown>;
  }> = [];

  for (const recipient of recipients) {
    const stats = getStats(recipient.id);
    const tokens = recipient.user.pushTokens ?? [];
    if (tokens.length > 0) stats.hadActiveToken = true;

    for (const token of tokens) {
      if (token.platform === "EXPO") {
        if (alreadySentExpo.has(token.id)) {
          stats.hadSentPreviously = true;
          continue;
        }
        if (!Expo.isExpoPushToken(token.token)) {
          stats.invalid += 1;
          await invalidateToken(token.id, "INVALID_EXPO_TOKEN");
          await createLog({
            schoolId: notification.schoolId,
            notificationId: notification.id,
            recipientId: recipient.id,
            userId: recipient.userId,
            pushTokenId: token.id,
            channel: "MOBILE_PUSH",
            platform: "EXPO",
            status: "INVALID_TOKEN",
            errorCode: "INVALID_EXPO_TOKEN",
            errorMessage: "Expo token rejected by validator",
          });
          continue;
        }

        expoItems.push({
          pushTokenId: token.id,
          expoToken: token.token,
          projectId: token.projectId ?? null,
          recipientId: recipient.id,
          userId: recipient.userId,
          data: buildDeliveryPayload(notification, recipient),
          deviceInfo: token.deviceInfo ?? null,
        });
      }

      if (token.platform === "FCM") {
        if (alreadySentFcm.has(token.id)) {
          stats.hadSentPreviously = true;
          continue;
        }

        const existing = fcmGroups.find((group) => group.recipientId === recipient.id);
        if (existing) {
          existing.tokens.push({ pushTokenId: token.id, token: token.token });
        } else {
          fcmGroups.push({
            recipientId: recipient.id,
            userId: recipient.userId,
            tokens: [{ pushTokenId: token.id, token: token.token }],
            data: buildDeliveryPayload(notification, recipient),
          });
        }
      }
    }
  }

  let transientFailures = 0;

  // Expo batch send (reduces request count dramatically for large fanout).
  if (expoItems.length > 0) {
    logger.info(`[push] entering grouped send, totalItems=${expoItems.length}`);

    const sendExpo = async (messages: ExpoPushMessage[]) => {
      const tickets = await withTimeout(expoClient.sendPushNotificationsAsync(messages), 5000);

      console.log("🚨 EXPO TICKETS RAW:");
      console.log(JSON.stringify(tickets, null, 2));

      for (const ticket of tickets) {
        if (ticket.status === "error") {
          console.error("❌ PUSH TICKET ERROR:", {
            message: ticket.message,
            details: "details" in ticket ? ticket.details : undefined,
          });
        } else {
          console.log("✅ PUSH TICKET OK:", "id" in ticket ? ticket.id : undefined);
        }
      }

      const receiptIds: string[] = [];
      const receiptTokenById = new Map<string, string>();
      for (let index = 0; index < tickets.length; index += 1) {
        const ticket = tickets[index];
        if (!ticket || ticket.status !== "ok" || !("id" in ticket) || !ticket.id) continue;

        receiptIds.push(ticket.id);

        const message = messages[index];
        const token =
          message && typeof (message as { to?: unknown }).to === "string"
            ? ((message as { to: string }).to as string)
            : null;
        if (token) {
          receiptTokenById.set(ticket.id, token);
        }
      }

      console.log("📦 RECEIPT IDS:", receiptIds);

      if (receiptIds.length > 0) {
        try {
          const receipts = await withTimeout(expoClient.getPushNotificationReceiptsAsync(receiptIds), 5000);

          console.log("🚨 EXPO RECEIPTS RAW:");
          console.log(JSON.stringify(receipts, null, 2));

          for (const [id, receipt] of Object.entries(receipts)) {
            if (receipt && typeof receipt === "object" && "status" in receipt && receipt.status === "error") {
              const error = (receipt as { details?: { error?: string } }).details?.error;

              if (error === "DeviceNotRegistered") {
                const token = receiptTokenById.get(id);
                if (token) {
                  console.log("🧹 Removing invalid token:", token);

                  await prisma.pushToken.updateMany({
                    where: { token },
                    data: { invalidatedAt: new Date() },
                  });
                }
              }

              console.error("❌ PUSH RECEIPT ERROR:", {
                id,
                message: "message" in receipt ? (receipt as { message?: unknown }).message : undefined,
                details: "details" in receipt ? (receipt as { details?: unknown }).details : undefined,
              });
            } else {
              console.log("✅ PUSH RECEIPT OK:", id);
            }
          }
        } catch (err) {
          console.error("❌ PUSH RECEIPT ERROR:", {
            id: "RECEIPT_FETCH_FAILED",
            message: err instanceof Error ? err.message : String(err),
            details: err,
          });
        }
      }

      return tickets;
    };

    const groups = new Map<string, typeof expoItems>();
    for (const item of expoItems) {
      const project = item.projectId?.trim() || null;
      if (!project) {
        logger.error(`[push] missing projectId for Expo token pushTokenId=${item.pushTokenId}`);
        continue;
      }

      const list = groups.get(project);
      if (list) {
        list.push(item);
      } else {
        groups.set(project, [item]);
      }
    }

    if (groups.size === 0) {
      logger.error("[push] no valid Expo project groups formed; skipping Expo send");
    }

    if (expoItems.length > 0 && groups.size === 1) {
      const project = [...groups.keys()][0];
      logger.warn(`[push] only one group detected: ${project}`);
    }

    logger.info(`[push] grouped tokens: ${groups.size}`);
    for (const [project, items] of groups) {
      if (items.length === 0) continue;

      logger.info(`[push] sending project=${project} tokens=${items.length}`);

      const messages: ExpoPushMessage[] = items.map((item) => ({
        to: item.expoToken,
        title: notification.title,
        body: notification.body,
        data: item.data,
        sound: "default",
        priority: "high",
      }));

      let offset = 0;
      for (const chunk of expoClient.chunkPushNotifications(messages)) {
        const chunkItems = items.slice(offset, offset + chunk.length);
        offset += chunk.length;

        let tickets: ExpoPushTicket[];
        try {
          tickets = await sendExpo(chunk);
        } catch (error) {
          transientFailures += chunkItems.length;
          await Promise.all(
            chunkItems.map(async (item) => {
              const stats = getStats(item.recipientId);
              stats.failed += 1;
              try {
                await createLog({
                  schoolId: notification.schoolId,
                  notificationId: notification.id,
                  recipientId: item.recipientId,
                  userId: item.userId,
                  pushTokenId: item.pushTokenId,
                  channel: "MOBILE_PUSH",
                  platform: "EXPO",
                  status: "FAILED",
                  errorCode:
                    error instanceof Error && error.message === "Push timeout"
                      ? "PUSH_TIMEOUT"
                      : "EXPO_PUSH_FAILED",
                  errorMessage: error instanceof Error ? error.message : String(error),
                });
              } catch (logError) {
                logger.error("[NOTIFICATION] failed to write expo failure log", logError);
              }
            })
          );
          continue;
        }

        await Promise.all(
          tickets.map(async (ticket: ExpoPushTicket, index) => {
            const item = chunkItems[index];
            if (!item) return;
            const stats = getStats(item.recipientId);

            if (ticket.status === "ok") {
              stats.sent += 1;
              try {
                await createLog({
                  schoolId: notification.schoolId,
                  notificationId: notification.id,
                  recipientId: item.recipientId,
                  userId: item.userId,
                  pushTokenId: item.pushTokenId,
                  channel: "MOBILE_PUSH",
                  platform: "EXPO",
                  status: "SENT",
                  providerMessageId: (ticket as ExpoPushSuccessTicket).id ?? null,
                  deliveredAt: new Date(),
                });
              } catch (logError) {
                logger.error("[NOTIFICATION] failed to write expo sent log", logError);
              }
              return;
            }

            stats.failed += 1;
            const details = "details" in ticket && ticket.details ? ticket.details : undefined;
            const errorCode =
              details && typeof details === "object" && "error" in details
                ? String(details.error)
                : ticket.message ?? "EXPO_PUSH_FAILED";
            const invalidToken = errorCode === "DeviceNotRegistered";
            if (invalidToken) {
              stats.invalid += 1;
              try {
                await invalidateToken(item.pushTokenId, errorCode);
              } catch (invalidateError) {
                logger.error("[NOTIFICATION] failed to invalidate expo token", invalidateError);
              }
            } else {
              transientFailures += 1;
            }

            try {
              await createLog({
                schoolId: notification.schoolId,
                notificationId: notification.id,
                recipientId: item.recipientId,
                userId: item.userId,
                pushTokenId: item.pushTokenId,
                channel: "MOBILE_PUSH",
                platform: "EXPO",
                status: invalidToken ? "INVALID_TOKEN" : "FAILED",
                errorCode,
                errorMessage: ticket.message ?? null,
              });
            } catch (logError) {
              logger.error("[NOTIFICATION] failed to write expo failure log", logError);
            }
          })
        );
      }
    }
  }

  // FCM send (per-recipient multicast so recipient-scoped payload stays correct).
  if (fcmGroups.length > 0) {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
      for (const group of fcmGroups) {
        const stats = getStats(group.recipientId);
        stats.skipped += group.tokens.length;
        await Promise.all(
          group.tokens.map((item) =>
            createLog({
              schoolId: notification.schoolId,
              notificationId: notification.id,
              recipientId: group.recipientId,
              userId: group.userId,
              pushTokenId: item.pushTokenId,
              channel: "WEB_PUSH",
              platform: "FCM",
              status: "SKIPPED",
              errorCode: "FCM_NOT_CONFIGURED",
              errorMessage: "Firebase Admin is not configured",
            }).catch((logError) => {
              logger.error("[NOTIFICATION] failed to write fcm skipped log", logError);
            })
          )
        );
      }
    } else {
      const limit = pLimit(15);
      await Promise.all(
        fcmGroups.map((group) =>
          limit(async () => {
            const stats = getStats(group.recipientId);
            const data = toFcmData(group.data);
            const tokens = group.tokens.map((t) => t.token);

            if (tokens.length === 0) return;

            let batch;
            try {
              batch = await withTimeout(
                messaging.sendEachForMulticast({
                  tokens,
                  notification: {
                    title: notification.title,
                    body: notification.body,
                  },
                  data,
                }),
                5000
              );
            } catch (error) {
              transientFailures += tokens.length;
              stats.failed += tokens.length;
              await Promise.all(
                group.tokens.map((item) =>
                  createLog({
                    schoolId: notification.schoolId,
                    notificationId: notification.id,
                    recipientId: group.recipientId,
                    userId: group.userId,
                    pushTokenId: item.pushTokenId,
                    channel: "WEB_PUSH",
                    platform: "FCM",
                    status: "FAILED",
                    errorCode:
                      error instanceof Error && error.message === "Push timeout"
                        ? "PUSH_TIMEOUT"
                        : "FCM_SEND_FAILED",
                    errorMessage: error instanceof Error ? error.message : String(error),
                  }).catch((logError) => {
                    logger.error("[NOTIFICATION] failed to write fcm failure log", logError);
                  })
                )
              );
              return;
            }

            await Promise.all(
              batch.responses.map(async (resp, index) => {
                const item = group.tokens[index];
                if (!item) return;

                if (resp.success) {
                  stats.sent += 1;
                  await createLog({
                    schoolId: notification.schoolId,
                    notificationId: notification.id,
                    recipientId: group.recipientId,
                    userId: group.userId,
                    pushTokenId: item.pushTokenId,
                    channel: "WEB_PUSH",
                    platform: "FCM",
                    status: "SENT",
                    providerMessageId: resp.messageId ?? null,
                    deliveredAt: new Date(),
                  }).catch((logError) => {
                    logger.error("[NOTIFICATION] failed to write fcm sent log", logError);
                  });
                  return;
                }

                stats.failed += 1;
                const rawCode =
                  resp.error && typeof resp.error === "object" && "code" in resp.error
                    ? String((resp.error as { code?: unknown }).code)
                    : "FCM_SEND_FAILED";
                const classification = classifyFcmErrorCode(rawCode);
                const invalidToken = classification.invalid;
                if (invalidToken) {
                  stats.invalid += 1;
                  try {
                    await invalidateToken(item.pushTokenId, rawCode);
                  } catch (invalidateError) {
                    logger.error("[NOTIFICATION] failed to invalidate fcm token", invalidateError);
                  }
                } else if (classification.transient) {
                  transientFailures += 1;
                } else {
                  transientFailures += 1;
                }

                await createLog({
                  schoolId: notification.schoolId,
                  notificationId: notification.id,
                  recipientId: group.recipientId,
                  userId: group.userId,
                  pushTokenId: item.pushTokenId,
                  channel: "WEB_PUSH",
                  platform: "FCM",
                  status: invalidToken ? "INVALID_TOKEN" : "FAILED",
                  errorCode: rawCode,
                  errorMessage: resp.error ? resp.error.message : null,
                }).catch((logError) => {
                  logger.error("[NOTIFICATION] failed to write fcm failure log", logError);
                });
              })
            );
          })
        )
      );
    }
  }

  const groups = new Map<string, string[]>();
  const addTo = (status: string, id: string) => {
    const list = groups.get(status) ?? [];
    list.push(id);
    groups.set(status, list);
  };

  for (const recipient of recipients) {
    const stats = getStats(recipient.id);
    if (!stats.hadActiveToken) {
      addTo("NO_TOKEN", recipient.id);
      continue;
    }

    const deliveredCount = stats.sent + (stats.hadSentPreviously ? 1 : 0);
    if (deliveredCount > 0) {
      const transient = Math.max(0, stats.failed - stats.invalid);
      addTo(transient > 0 ? "PARTIAL" : "DELIVERED", recipient.id);
      continue;
    }

    const transient = Math.max(0, stats.failed - stats.invalid);
    if (transient > 0) {
      addTo("RETRY", recipient.id);
      continue;
    }

    if (stats.invalid > 0) {
      addTo("FAILED", recipient.id);
      continue;
    }

    // If provider isn't configured (or we intentionally skipped push), in-app is still delivered.
    addTo("DELIVERED", recipient.id);
  }

  for (const [status, ids] of groups) {
    await prisma.notificationRecipient.updateMany({
      where: { id: { in: ids } },
      data: { deliveryStatus: status },
    });
  }

  if (transientFailures > 0) {
    // Trigger BullMQ retry. Delivery is idempotent per token due to SENT log checks.
    throw new Error(`Transient push failures: ${transientFailures}`);
  }

  return { deliveredRecipients: recipients.length };
}

export async function markNotificationDeliveryFailed(notificationId: string, reason: string) {
  await prisma.notificationRecipient.updateMany({
    where: {
      notificationId,
      deliveryStatus: { in: ["QUEUED", "RETRY", "FAILED", "PROCESSING", "PARTIAL", "NO_TOKEN"] },
    },
    data: { deliveryStatus: "FAILED" },
  });

  logger.error(`[NOTIFICATION] delivery failed notification=${notificationId} reason=${reason}`);
  await escalateNotification(notificationId);
}

export async function escalateNotification(notificationId: string) {
  // Future hook: plug email/SMS escalation here (PagerDuty, etc).
  logger.warn(`[NOTIFICATION] escalate hook called notification=${notificationId}`);
}

export async function cleanupPushTokens(params: { schoolId: string; retentionDays?: number }) {
  const retentionDays = Number.isFinite(params.retentionDays) ? Number(params.retentionDays) : 30;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const where = {
    schoolId: params.schoolId,
    OR: [{ invalidatedAt: { not: null } }, { lastSeenAt: { lt: cutoff } }],
  } satisfies Prisma.PushTokenWhereInput;

  let deletedTotal = 0;

  try {
    while (true) {
      const batch = await prisma.pushToken.findMany({
        where,
        select: { id: true },
        orderBy: { id: "asc" },
        take: 500,
      });

      if (batch.length === 0) {
        break;
      }

      const ids = batch.map((row) => row.id);
      const result = await prisma.pushToken.deleteMany({
        where: { id: { in: ids } },
      });

      deletedTotal += result.count;
    }
  } catch (error) {
    logger.error(`[PUSH_TOKEN] cleanup error school=${params.schoolId}`, error);
  }

  logger.info(`[PUSH_TOKEN] cleanup school=${params.schoolId} deleted=${deletedTotal}`);
  return deletedTotal;
}

export async function aggregateNotificationDelivery(params: { schoolId: string; windowMinutes: number }) {
  const since = new Date(Date.now() - params.windowMinutes * 60 * 1000);

  const logs = await prisma.notificationLog.groupBy({
    by: ["status"],
    where: {
      schoolId: params.schoolId,
      createdAt: { gte: since },
      channel: { in: ["MOBILE_PUSH", "WEB_PUSH"] },
      status: { in: ["SENT", "FAILED", "INVALID_TOKEN"] },
    },
    _count: { status: true },
  });

  const out = { sent: 0, failed: 0, invalid: 0 };
  for (const row of logs) {
    if (row.status === "SENT") out.sent = row._count.status;
    if (row.status === "FAILED") out.failed = row._count.status;
    if (row.status === "INVALID_TOKEN") out.invalid = row._count.status;
  }

  const total = out.sent + out.failed + out.invalid;
  const failureRate = total > 0 ? out.failed / total : 0;

  const metrics = {
    schoolId: params.schoolId,
    sent: out.sent,
    failed: out.failed,
    invalid: out.invalid,
    total,
    failureRate,
    timestamp: new Date().toISOString(),
    since: since.toISOString(),
  };

  void (async () => {
    try {
      const redis = await getRedis();
      if (!redis) return;

      const key = `notification:metrics:${params.schoolId}`;
      const payload = JSON.stringify({
        schoolId: metrics.schoolId,
        sent: metrics.sent,
        failed: metrics.failed,
        invalid: metrics.invalid,
        total: metrics.total,
        failureRate: metrics.failureRate,
        timestamp: metrics.timestamp,
      });

      await redis.multi().lpush(key, payload).ltrim(key, 0, 1999).exec();
    } catch (error) {
      logger.warn("[NOTIFICATION] metrics persist failed", error);
    }
  })();

  return metrics;
}
