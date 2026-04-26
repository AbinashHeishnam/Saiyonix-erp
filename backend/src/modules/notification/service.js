import prisma from "@/core/db/prisma";
import { getSmsConfig } from "@/core/config/externalServices";
import { ApiError } from "@/core/errors/apiError";
import { getNotificationQueue } from "@/core/queue/notificationBullmq";
import { sendSMS } from "@/core/services/sms.service";
import { queueNotificationDelivery, registerPushToken as registerPushTokenRecord, removePushToken as removePushTokenRecord, } from "@/services/notificationService";
import { logAudit } from "@/utils/audit";
import { chunkArray } from "@/core/utils/perf";
import { eventConfig } from "@/modules/notification/eventConfig";
import { resolveRecipients } from "@/modules/notification/resolvers";
import { renderTemplate } from "@/modules/notification/templates";
import { logger } from "@/utils/logger";
function getDeliveryChannels(priority) {
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
function ensureSchoolId(payload) {
    if (!payload.schoolId) {
        throw new ApiError(400, "schoolId is required");
    }
    return payload.schoolId;
}
export async function enqueuePushJob(payload) {
    try {
        const queue = await getNotificationQueue();
        if (!queue) {
            console.warn("[queue] notification queue unavailable");
            return false;
        }
        await queue.add("notify", {
            notificationId: payload.notificationId ?? null,
            userIds: payload.userIds,
            message: payload.message,
            title: payload.title ?? null,
            body: payload.body ?? null,
            schoolId: payload.schoolId ?? null,
        });
        if (process.env.NODE_ENV !== "production") {
            console.info(`[queue] notification enqueued users=${payload.userIds.length} school=${payload.schoolId ?? "n/a"}`);
        }
        return true;
    }
    catch (err) {
        console.error("[queue] notification enqueue failed", err);
        return false;
    }
}
export async function trigger(eventType, payload) {
    console.log("🔥 SERVICE HIT", { payload });
    logger.info(`[trace] 🔥 SERVICE HIT trigger eventType=${eventType} payload=${JSON.stringify(payload ?? null)}`);
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
                type: payload.metadata?.type === "attendance"
                    ? "ATTENDANCE"
                    : payload.metadata?.type === "notice"
                        ? "NOTICE"
                        : "GENERAL",
                eventType,
                title,
                body,
                data: payload.metadata ?? undefined,
                category: config.category ?? null,
                priority: config.priority,
                sentVia: config.deliveryChannels,
                sentById: payload.sentById ?? null,
                entityType: payload.entityType ?? null,
                entityId: payload.entityId ?? null,
                linkUrl: payload.linkUrl ?? null,
                metadata: payload.metadata ?? undefined,
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
    if (config.deliveryChannels.includes("SMS")) {
        const smsConfig = await getSmsConfig();
        if (!smsConfig.enabled) {
            // Skip SMS when provider is not configured.
        }
        else {
            try {
                const users = await prisma.user.findMany({
                    where: { id: { in: recipients }, schoolId, mobile: { not: null } },
                    select: { mobile: true },
                });
                const mobiles = users
                    .map((user) => user.mobile)
                    .filter((mobile) => Boolean(mobile));
                const chunks = chunkArray(mobiles, 50);
                for (const chunk of chunks) {
                    await Promise.all(chunk.map((mobile) => sendSMS({ phoneNumber: mobile, message: body })));
                }
            }
            catch {
                // Ignore SMS failures to preserve in-app notification flow.
            }
        }
    }
    console.log("🔥 CHANNEL CHECK", {
        deliveryChannels: config.deliveryChannels,
        configChannels: config?.deliveryChannels,
        targetType: payload.targetType,
    });
    logger.info(`[trace] 🔥 CHANNEL CHECK trigger eventType=${eventType} channels=${JSON.stringify(config.deliveryChannels)}`);
    logger.info(`[DEBUG] deliveryChannels=${JSON.stringify(config.deliveryChannels)} targetType=${payload?.targetType ?? "unknown"}`);
    if (config.deliveryChannels.includes("PUSH")) {
        try {
            console.log("🔥 BEFORE QUEUE", notification.id);
            console.log("[DEBUG] before queue call", notification.id);
            await queueNotificationDelivery(notification.id);
            console.log("[DEBUG] after queue call");
        }
        catch {
            throw new Error("Queue failed — no fallback allowed");
        }
    }
    else {
        console.log("[DEBUG] push skipped", {
            notificationId: notification.id,
            deliveryChannels: config.deliveryChannels,
            eventType,
        });
    }
    return { notification, recipientCount: recipients.length };
}
export async function sendNotification(schoolId, payload, sentById, idempotencyKey) {
    console.log("🔥 SERVICE HIT", { payload });
    logger.info(`[trace] 🔥 SERVICE HIT sendNotification schoolId=${schoolId} payload=${JSON.stringify(payload ?? null)}`);
    const deliveryChannels = getDeliveryChannels(payload.priority);
    const notificationPayload = {
        schoolId,
        sentById,
        classId: payload.classId,
        sectionId: payload.sectionId,
        linkUrl: payload.linkUrl,
        entityType: payload.entityType,
        entityId: payload.entityId,
        metadata: payload.metadata,
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
        }
        catch (error) {
            const code = error && typeof error === "object" && "code" in error
                ? String(error.code)
                : "";
            if (code === "P2002") {
                const existingJob = await prisma.notificationJob.findUnique({
                    where: { idempotencyKey },
                });
                if (existingJob && existingJob.schoolId !== schoolId) {
                    throw new ApiError(403, "Idempotency key already used for another school");
                }
                const stored = existingJob?.payload;
                if (stored?.result) {
                    return stored.result;
                }
                return { notification: null, recipientCount: 0 };
            }
            throw error;
        }
    }
    try {
        let strategy;
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
                    type: payload.metadata?.type === "attendance"
                        ? "ATTENDANCE"
                        : payload.metadata?.type === "notice"
                            ? "NOTICE"
                            : "GENERAL",
                    eventType: payload.category ? `MANUAL_${payload.category}` : "MANUAL",
                    title: payload.title,
                    body: payload.body,
                    data: payload.metadata ?? undefined,
                    category: payload.category ?? null,
                    priority: payload.priority,
                    sentVia: deliveryChannels,
                    sentById: sentById ?? null,
                    entityType: payload.entityType ?? null,
                    entityId: payload.entityId ?? null,
                    linkUrl: payload.linkUrl ?? null,
                    metadata: payload.metadata ?? undefined,
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
        if (deliveryChannels.includes("SMS")) {
            const smsConfig = await getSmsConfig();
            if (!smsConfig.enabled) {
                // Skip SMS when provider is not configured.
            }
            else {
                try {
                    const users = await prisma.user.findMany({
                        where: { id: { in: recipients }, schoolId, mobile: { not: null } },
                        select: { mobile: true },
                    });
                    const mobiles = users
                        .map((user) => user.mobile)
                        .filter((mobile) => Boolean(mobile));
                    const chunks = chunkArray(mobiles, 50);
                    for (const chunk of chunks) {
                        await Promise.all(chunk.map((mobile) => sendSMS({ phoneNumber: mobile, message: payload.body })));
                    }
                }
                catch {
                    // Ignore SMS failures to preserve in-app notification flow.
                }
            }
        }
        const result = { notification, recipientCount: recipients.length };
        console.log("🔥 CHANNEL CHECK", {
            deliveryChannels,
            configChannels: undefined,
            targetType: payload.targetType,
        });
        logger.info(`[trace] 🔥 CHANNEL CHECK sendNotification targetType=${payload.targetType} channels=${JSON.stringify(deliveryChannels)}`);
        logger.info(`[DEBUG] deliveryChannels=${JSON.stringify(deliveryChannels)} targetType=${payload?.targetType ?? "unknown"}`);
        if (deliveryChannels.includes("PUSH")) {
            try {
                console.log("🔥 BEFORE QUEUE", notification.id);
                console.log("[DEBUG] before queue call", notification.id);
                await queueNotificationDelivery(notification.id);
                console.log("[DEBUG] after queue call");
            }
            catch {
                throw new Error("Queue failed — no fallback allowed");
            }
        }
        else {
            console.log("[DEBUG] push skipped", {
                notificationId: notification.id,
                priority: payload.priority,
                deliveryChannels,
                targetType: payload.targetType,
            });
            logger.info(`[trace] push skipped notificationId=${notification.id} priority=${payload.priority} channels=${JSON.stringify(deliveryChannels)} targetType=${payload.targetType}`);
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
    }
    catch (error) {
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
export async function listNotifications(schoolId, userId, pagination) {
    const where = {
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
                        type: true,
                        data: true,
                        category: true,
                        priority: true,
                        eventType: true,
                        entityType: true,
                        entityId: true,
                        linkUrl: true,
                        metadata: true,
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
export async function getUnreadCount(schoolId, userId) {
    const count = await prisma.notificationRecipient.count({
        where: { userId, readAt: null, notification: { schoolId } },
    });
    return { count };
}
export async function markRead(schoolId, userId, notificationId) {
    const now = new Date();
    const byRecipient = await prisma.notificationRecipient.updateMany({
        where: { id: notificationId, userId, notification: { schoolId } },
        data: { readAt: now },
    });
    if (byRecipient.count > 0) {
        return { id: notificationId, readAt: now };
    }
    const result = await prisma.notificationRecipient.updateMany({
        where: { userId, notificationId, notification: { schoolId } },
        data: { readAt: now },
    });
    if (result.count === 0) {
        throw new ApiError(404, "Notification not found");
    }
    return { id: notificationId, readAt: now };
}
export async function markAllRead(schoolId, userId) {
    const now = new Date();
    const result = await prisma.notificationRecipient.updateMany({
        where: { userId, readAt: null, notification: { schoolId } },
        data: { readAt: now },
    });
    return { updated: result.count, readAt: now };
}
export async function registerPushToken(params) {
    return registerPushTokenRecord(params);
}
export async function removePushToken(params) {
    return removePushTokenRecord(params);
}
