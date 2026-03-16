import type { Prisma, NotificationPriority, UserRole } from "@prisma/client";

import prisma from "../../core/db/prisma";
import { smsConfig } from "../../core/config/externalServices";
import { ApiError } from "../../core/errors/apiError";
import { enqueueNotificationJob } from "../../core/queue/notificationQueue";
import { sendSMS } from "../../core/services/sms.service";
import { logAudit } from "../../utils/audit";
import { eventConfig } from "./eventConfig";
import { resolveRecipients } from "./resolvers";
import { renderTemplate } from "./templates";
import type { DeliveryChannel, EventType, NotificationPayload } from "./types";
import type { SendNotificationInput } from "./send.validation";

type NotificationRecipientWithNotification = Prisma.NotificationRecipientGetPayload<{
  select: {
    id: true;
    readAt: true;
    createdAt: true;
    notification: {
      select: {
        id: true;
        title: true;
        body: true;
        category: true;
        priority: true;
        sentAt: true;
        createdAt: true;
      };
    };
  };
}>;

type TriggerResult = {
  notification: Prisma.NotificationGetPayload<{}> | null;
  recipientCount: number;
};

function getDeliveryChannels(priority: NotificationPriority): DeliveryChannel[] {
  switch (priority) {
    case "LOW":
      return ["IN_APP"];
    case "MEDIUM":
      return ["PUSH"];
    case "HIGH":
      return ["PUSH", "SMS"];
    case "CRITICAL":
      // Repeat alert requires queue/scheduler; not implemented yet.
      return ["PUSH", "SMS"];
    default:
      return ["IN_APP"];
  }
}

function ensureSchoolId(payload: NotificationPayload): string {
  if (!payload.schoolId) {
    throw new ApiError(400, "schoolId is required");
  }

  return payload.schoolId;
}

export async function trigger(
  eventType: EventType,
  payload: NotificationPayload
): Promise<TriggerResult> {
  const schoolId = ensureSchoolId(payload);
  const config = eventConfig[eventType];

  if (!config) {
    throw new ApiError(400, "Unsupported notification event type");
  }

  const { title, body } = renderTemplate(eventType, payload);
  const recipients = await resolveRecipients(config.resolver, payload);

  if (recipients.length === 0) {
    return { notification: null, recipientCount: 0 };
  }

  const notification = await prisma.$transaction(async (tx) => {
    const created = await tx.notification.create({
      data: {
        schoolId,
        title,
        body,
        category: config.category ?? null,
        priority: config.priority,
        sentVia: config.deliveryChannels,
        sentById: payload.sentById ?? null,
        scheduledAt: payload.scheduledAt ?? null,
        sentAt: new Date(),
      },
    });

    await tx.notificationRecipient.createMany({
      data: recipients.map((userId) => ({
        notificationId: created.id,
        userId,
      })),
      skipDuplicates: true,
    });

    return created;
  });

  if (config.deliveryChannels.includes("SMS") && smsConfig.enabled) {
    try {
      const users = await prisma.user.findMany({
        where: { id: { in: recipients }, schoolId, mobile: { not: null } },
        select: { mobile: true },
      });

      await Promise.all(
        users
          .map((user) => user.mobile)
          .filter((mobile): mobile is string => Boolean(mobile))
          .map((mobile) => sendSMS({ phoneNumber: mobile, message: body }))
      );
    } catch {
      // Ignore SMS failures to preserve in-app notification flow.
    }
  }

  if (config.deliveryChannels.includes("PUSH")) {
    await enqueueNotificationJob({
      schoolId,
      userIds: recipients,
      title,
      body,
      data: payload.metadata ?? null,
    });
  }

  return { notification, recipientCount: recipients.length };
}

export async function sendNotification(
  schoolId: string,
  payload: SendNotificationInput,
  sentById?: string,
  idempotencyKey?: string
): Promise<TriggerResult> {
  const deliveryChannels = getDeliveryChannels(payload.priority);
  const notificationPayload: NotificationPayload = {
    schoolId,
    sentById,
    classId: payload.classId,
    sectionId: payload.sectionId,
  };

  if (idempotencyKey) {
    try {
      await prisma.notificationJob.create({
        data: {
          schoolId,
          idempotencyKey,
          status: "PROCESSING",
          payload: { request: payload, sentById },
        },
      });
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "";

      if (code === "P2002") {
        const existingJob = await prisma.notificationJob.findUnique({
          where: { idempotencyKey },
        });

        if (existingJob && existingJob.schoolId !== schoolId) {
          throw new ApiError(403, "Idempotency key already used for another school");
        }

        const stored = existingJob?.payload as { result?: TriggerResult } | null;
        if (stored?.result) {
          return stored.result;
        }

        return { notification: null, recipientCount: 0 };
      }

      throw error;
    }
  }

  try {
    let strategy:
      | { type: "SCHOOL_ALL" }
      | { type: "ROLE_ALL"; roles: UserRole[] }
      | { type: "CLASS" }
      | { type: "SECTION" };

    switch (payload.targetType) {
      case "ENTIRE_SCHOOL":
        strategy = { type: "SCHOOL_ALL" };
        break;
      case "ALL_STUDENTS":
        strategy = { type: "ROLE_ALL", roles: ["STUDENT"] };
        break;
      case "ALL_TEACHERS":
        strategy = { type: "ROLE_ALL", roles: ["TEACHER"] };
        break;
      case "ALL_PARENTS":
        strategy = { type: "ROLE_ALL", roles: ["PARENT"] };
        break;
      case "CLASS":
        strategy = { type: "CLASS" };
        break;
      case "SECTION":
        strategy = { type: "SECTION" };
        break;
      default:
        throw new ApiError(400, "Unsupported notification target type");
    }

    const recipients = await resolveRecipients(strategy, notificationPayload);

    if (recipients.length === 0) {
      const emptyResult = { notification: null, recipientCount: 0 };

      if (idempotencyKey) {
        await prisma.notificationJob.update({
          where: { idempotencyKey },
          data: {
            status: "COMPLETED",
            payload: { request: payload, result: emptyResult },
          },
        });
      }

      return emptyResult;
    }

    const notification = await prisma.$transaction(async (tx) => {
      const created = await tx.notification.create({
        data: {
          schoolId,
          title: payload.title,
          body: payload.body,
          category: payload.category ?? null,
          priority: payload.priority,
          sentVia: deliveryChannels,
          sentById: sentById ?? null,
          scheduledAt: null,
          sentAt: new Date(),
        },
      });

      await tx.notificationRecipient.createMany({
        data: recipients.map((userId) => ({
          notificationId: created.id,
          userId,
        })),
        skipDuplicates: true,
      });

      return created;
    });

    if (deliveryChannels.includes("SMS") && smsConfig.enabled) {
      try {
        const users = await prisma.user.findMany({
          where: { id: { in: recipients }, schoolId, mobile: { not: null } },
          select: { mobile: true },
        });

        await Promise.all(
          users
            .map((user) => user.mobile)
            .filter((mobile): mobile is string => Boolean(mobile))
            .map((mobile) => sendSMS({ phoneNumber: mobile, message: payload.body }))
        );
      } catch {
        // Ignore SMS failures to preserve in-app notification flow.
      }
    }

    const result = { notification, recipientCount: recipients.length };

    if (deliveryChannels.includes("PUSH")) {
      await enqueueNotificationJob({
        schoolId,
        userIds: recipients,
        title: payload.title,
        body: payload.body,
        data: null,
      });
    }

    if (idempotencyKey) {
      await prisma.notificationJob.update({
        where: { idempotencyKey },
        data: {
          status: "COMPLETED",
          payload: { request: payload, result },
        },
      });
    }

    if (notification?.id) {
      await logAudit({
        userId: sentById,
        action: "SEND",
        entity: "Notification",
        entityId: notification.id,
        metadata: {
          targetType: payload.targetType,
          priority: payload.priority,
        },
      });
    }

    return result;
  } catch (error) {
    if (idempotencyKey) {
      await prisma.notificationJob.update({
        where: { idempotencyKey },
        data: {
          status: "FAILED",
          payload: { request: payload, error: String(error) },
        },
      });
    }

    throw error;
  }
}

export async function listNotifications(
  schoolId: string,
  userId: string,
  pagination?: { skip: number; take: number }
): Promise<{ items: NotificationRecipientWithNotification[]; total: number }> {
  const where: Prisma.NotificationRecipientWhereInput = {
    userId,
    notification: { schoolId },
  };

  const [items, total] = await prisma.$transaction([
    prisma.notificationRecipient.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
      select: {
        id: true,
        readAt: true,
        createdAt: true,
        notification: {
          select: {
            id: true,
            title: true,
            body: true,
            category: true,
            priority: true,
            sentAt: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.notificationRecipient.count({ where }),
  ]);

  return { items, total };
}

export async function getUnreadCount(
  schoolId: string,
  userId: string
): Promise<{ count: number }> {
  const count = await prisma.notificationRecipient.count({
    where: { userId, readAt: null, notification: { schoolId } },
  });

  return { count };
}

export async function markRead(
  schoolId: string,
  userId: string,
  notificationId: string
): Promise<{ id: string; readAt: Date }> {
  const now = new Date();
  const result = await prisma.notificationRecipient.updateMany({
    where: { userId, notificationId, notification: { schoolId } },
    data: { readAt: now },
  });

  if (result.count === 0) {
    throw new ApiError(404, "Notification not found");
  }

  return { id: notificationId, readAt: now };
}

export async function markAllRead(
  schoolId: string,
  userId: string
): Promise<{ updated: number; readAt: Date }> {
  const now = new Date();
  const result = await prisma.notificationRecipient.updateMany({
    where: { userId, readAt: null, notification: { schoolId } },
    data: { readAt: now },
  });

  return { updated: result.count, readAt: now };
}
