import crypto from "crypto";
import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { queueNotificationDelivery } from "@/services/notificationService";
function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}
function uniq(ids) {
    return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim().length > 0)));
}
function stableStringify(value) {
    if (value === null || value === undefined)
        return "null";
    if (typeof value !== "object")
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map((v) => stableStringify(v)).join(",")}]`;
    const record = value;
    const keys = Object.keys(record).sort();
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
    return `{${entries.join(",")}}`;
}
function sha256Hex(input) {
    return crypto.createHash("sha256").update(input).digest("hex");
}
function resolveEntityId(input) {
    const meta = input.meta ?? {};
    const raw = meta.entityId;
    if (raw !== null && raw !== undefined) {
        if (typeof raw === "string")
            return raw;
        if (typeof raw === "number" || typeof raw === "boolean")
            return String(raw);
        try {
            return JSON.stringify(raw);
        }
        catch {
            return String(raw);
        }
    }
    const fingerprint = stableStringify({
        type: input.type,
        title: input.title,
        message: input.message,
        senderId: input.senderId,
        targetType: input.targetType,
        role: input.role ?? null,
        classId: input.classId ?? null,
        userIds: uniq(input.userIds ?? []).sort(),
        meta,
    });
    return `hash:${sha256Hex(fingerprint)}`;
}
function mapRole(inputRole) {
    if (!inputRole) {
        throw new ApiError(400, "role is required for ROLE targetType");
    }
    switch (inputRole) {
        case "ADMIN":
            return ["SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "FINANCE_SUB_ADMIN"];
        case "TEACHER":
            return ["TEACHER"];
        case "STUDENT":
            return ["STUDENT"];
        case "PARENT":
            return ["PARENT"];
        default:
            throw new ApiError(400, "Invalid role");
    }
}
function resolveNotificationTypeEnum(eventType) {
    const upper = eventType.toUpperCase();
    if (upper.includes("ATTENDANCE"))
        return "ATTENDANCE";
    if (upper.includes("NOTICE"))
        return "NOTICE";
    return "GENERAL";
}
function ensureValidTargetType(input) {
    const allowed = new Set(["ALL", "ROLE", "USER", "CLASS"]);
    if (!allowed.has(input.targetType)) {
        throw new ApiError(400, "Invalid targetType");
    }
    if (input.targetType === "USER") {
        if (!input.userIds || input.userIds.length === 0) {
            throw new ApiError(400, "USER targetType requires userIds");
        }
    }
    if (input.targetType === "ROLE") {
        if (!input.role) {
            throw new ApiError(400, "ROLE targetType requires role");
        }
    }
    if (input.targetType === "CLASS") {
        if (!input.classId) {
            throw new ApiError(400, "CLASS targetType requires classId");
        }
    }
}
async function ensureSenderContext(senderId) {
    const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, schoolId: true },
    });
    if (!sender) {
        throw new ApiError(404, "Sender not found");
    }
    return sender;
}
async function resolveClassStudentUserIds(params) {
    const academicYearId = params.academicYearId;
    if (!academicYearId) {
        throw new ApiError(400, "Active academic year is required for CLASS notifications");
    }
    const enrollments = await prisma.studentEnrollment.findMany({
        where: {
            academicYearId,
            classId: params.classId,
            ...(params.sectionId ? { sectionId: params.sectionId } : {}),
            student: {
                schoolId: params.schoolId,
                deletedAt: null,
                status: "ACTIVE",
                userId: { not: null },
            },
        },
        select: {
            studentId: true,
            student: { select: { userId: true } },
        },
    });
    const studentIds = enrollments.map((item) => item.studentId);
    const studentUserIds = enrollments
        .map((item) => item.student.userId)
        .filter((id) => Boolean(id));
    return { studentUserIds: uniq(studentUserIds), studentIds: uniq(studentIds) };
}
async function resolveParentUserIdsForStudents(params) {
    if (params.studentIds.length === 0)
        return [];
    const links = await prisma.parentStudentLink.findMany({
        where: {
            studentId: { in: params.studentIds },
            isActive: true,
            parent: { schoolId: params.schoolId, userId: { not: null } },
        },
        select: {
            parent: { select: { userId: true } },
        },
    });
    const userIds = links
        .map((link) => link.parent.userId)
        .filter((id) => Boolean(id));
    return uniq(userIds);
}
export async function resolveRecipients(input) {
    ensureValidTargetType(input);
    const sender = await ensureSenderContext(input.senderId);
    if (input.targetType === "ALL") {
        const users = await prisma.user.findMany({
            where: { schoolId: sender.schoolId, isActive: true, id: { not: sender.id } },
            select: { id: true },
        });
        return uniq(users.map((user) => user.id));
    }
    if (input.targetType === "ROLE") {
        const roles = mapRole(input.role);
        const users = await prisma.user.findMany({
            where: {
                schoolId: sender.schoolId,
                isActive: true,
                id: { not: sender.id },
                role: { roleType: { in: roles } },
            },
            select: { id: true },
        });
        return uniq(users.map((user) => user.id));
    }
    if (input.targetType === "USER") {
        const requested = uniq(input.userIds ?? []);
        if (requested.length === 0) {
            throw new ApiError(400, "USER targetType requires userIds");
        }
        const existing = await prisma.user.findMany({
            where: { schoolId: sender.schoolId, id: { in: requested }, isActive: true },
            select: { id: true, isActive: true },
        });
        const existingSet = new Set(existing.map((user) => user.id));
        const missing = requested.filter((id) => !existingSet.has(id));
        if (missing.length === 0) {
            return requested;
        }
        // Defensive mapping: some call sites may accidentally pass profile IDs (student/parent/teacher)
        // instead of user IDs. Map known profile IDs -> linked userId, then re-validate.
        const [students, parents, teachers] = await Promise.all([
            prisma.student.findMany({
                where: { id: { in: missing }, schoolId: sender.schoolId, deletedAt: null, userId: { not: null } },
                select: { id: true, userId: true },
            }),
            prisma.parent.findMany({
                where: { id: { in: missing }, schoolId: sender.schoolId, userId: { not: null } },
                select: { id: true, userId: true },
            }),
            prisma.teacher.findMany({
                where: { id: { in: missing }, schoolId: sender.schoolId, deletedAt: null, userId: { not: null } },
                select: { id: true, userId: true },
            }),
        ]);
        const mapped = new Map();
        for (const row of students) {
            if (row.userId)
                mapped.set(row.id, row.userId);
        }
        for (const row of parents) {
            if (row.userId)
                mapped.set(row.id, row.userId);
        }
        for (const row of teachers) {
            if (row.userId)
                mapped.set(row.id, row.userId);
        }
        const remapped = uniq(requested.map((id) => mapped.get(id) ?? id));
        const validated = await prisma.user.findMany({
            where: { schoolId: sender.schoolId, id: { in: remapped }, isActive: true },
            select: { id: true },
        });
        const validatedSet = new Set(validated.map((user) => user.id));
        const stillMissing = remapped.filter((id) => !validatedSet.has(id));
        console.warn("[NOTIF ENGINE] USER target recipient mapping", {
            requestedCount: requested.length,
            missingCount: missing.length,
            mappedCount: mapped.size,
            remappedCount: remapped.length,
            stillMissingCount: stillMissing.length,
            sampleRequested: requested.slice(0, 10),
            sampleRemapped: remapped.slice(0, 10),
        });
        if (stillMissing.length > 0) {
            throw new ApiError(400, "One or more userIds are invalid/inactive for this school");
        }
        return remapped;
    }
    if (input.targetType === "CLASS") {
        const meta = input.meta ?? {};
        const academicYearId = typeof meta.academicYearId === "string"
            ? meta.academicYearId
            : (await prisma.academicYear.findFirst({
                where: { schoolId: sender.schoolId, isActive: true },
                select: { id: true },
            }))?.id ?? null;
        const sectionId = typeof meta.sectionId === "string" ? meta.sectionId : null;
        const includeParents = meta.includeParents === true;
        const { studentUserIds, studentIds } = await resolveClassStudentUserIds({
            schoolId: sender.schoolId,
            classId: input.classId,
            academicYearId,
            sectionId,
        });
        if (!includeParents) {
            return uniq(studentUserIds).filter((id) => id !== sender.id);
        }
        const parentUserIds = await resolveParentUserIdsForStudents({
            schoolId: sender.schoolId,
            studentIds,
        });
        return uniq([...studentUserIds, ...parentUserIds]).filter((id) => id !== sender.id);
    }
    throw new ApiError(400, "Invalid targetType");
}
import { resolveNotificationRecipients, NotificationType } from "./notificationTargetResolver";
export async function createAndDispatchNotification(input) {
    if (input.targetType !== "SECTION") {
        ensureValidTargetType(input);
    }
    console.info("[NOTIF ENGINE] type:", input.type);
    const sender = await ensureSenderContext(input.senderId);
    // Map to new structured payload
    const notifTypeStr = input.type.toUpperCase();
    let resolvedType = NotificationType.SYSTEM;
    if (notifTypeStr.includes("NOTICE"))
        resolvedType = NotificationType.NOTICE;
    else if (notifTypeStr.includes("ATTENDANCE"))
        resolvedType = NotificationType.ATTENDANCE;
    else if (notifTypeStr.includes("MESSAGE"))
        resolvedType = NotificationType.MESSAGE;
    else if (notifTypeStr.includes("ASSIGNMENT"))
        resolvedType = NotificationType.ASSIGNMENT;
    else if (notifTypeStr.includes("RESULT"))
        resolvedType = NotificationType.RESULT;
    else if (notifTypeStr.includes("EXAM"))
        resolvedType = NotificationType.EXAM;
    else if (notifTypeStr.includes("TIMETABLE"))
        resolvedType = NotificationType.TIMETABLE;
    else if (notifTypeStr.includes("CALENDAR"))
        resolvedType = NotificationType.CALENDAR;
    else if (notifTypeStr.includes("ADMIT_CARD"))
        resolvedType = NotificationType.ADMIT_CARD;
    else if (notifTypeStr.includes("PROMOTION"))
        resolvedType = NotificationType.PROMOTION;
    else if (notifTypeStr.includes("LEAVE"))
        resolvedType = NotificationType.LEAVE_STATUS;
    else if (notifTypeStr.includes("CERTIFICATE"))
        resolvedType = NotificationType.CERTIFICATE_STATUS;
    else if (notifTypeStr.includes("FEE"))
        resolvedType = NotificationType.FEE_UPDATE;
    const payload = {
        type: resolvedType,
        scope: (input.scope ?? input.targetType),
        role: input.role,
        classId: input.classId,
        sectionId: input.sectionId ?? input.meta?.sectionId,
        userIds: input.userIds,
        studentId: input.studentId,
        teacherId: input.teacherId,
        schoolId: sender.schoolId,
        senderId: input.senderId,
        title: input.title,
        message: input.message,
        fileUrl: input.meta?.fileUrl
    };
    const resolvedRecipients = await resolveNotificationRecipients(payload);
    console.info("[NOTIF ENGINE] recipients:", resolvedRecipients.length);
    if (resolvedRecipients.length === 0) {
        return {
            notificationId: null,
            resolvedRecipients: 0,
            createdRecipients: 0,
            skippedRecipients: 0,
        };
    }
    const meta = input.meta ?? undefined;
    const entityId = resolveEntityId(input);
    const notificationType = resolveNotificationTypeEnum(input.type);
    const created = await prisma.$transaction(async (tx) => {
        const record = await tx.notification.create({
            data: {
                schoolId: sender.schoolId,
                type: notificationType,
                eventType: input.type,
                title: input.title,
                body: input.message,
                sentById: input.senderId,
                entityType: meta?.entityType ? String(meta.entityType) : null,
                entityId,
                metadata: meta,
                sentVia: ["IN_APP", "MOBILE_PUSH"],
                sentAt: new Date(),
            },
            select: { id: true },
        });
        const recipientBatches = chunk(resolvedRecipients, 5000);
        for (const batch of recipientBatches) {
            await tx.notificationRecipient.createMany({
                data: batch.map((userId) => ({
                    notificationId: record.id,
                    userId,
                    type: input.type,
                    entityId,
                })),
                skipDuplicates: true,
            });
        }
        const inserted = await tx.notificationRecipient.findMany({
            where: { notificationId: record.id },
            select: { userId: true },
        });
        const insertedUserIds = uniq(inserted.map((row) => row.userId));
        if (insertedUserIds.length === 0) {
            await tx.notification.delete({ where: { id: record.id } });
            return { notificationId: null, userIds: [] };
        }
        return { notificationId: record.id, userIds: insertedUserIds };
    });
    if (created.notificationId) {
        await queueNotificationDelivery(created.notificationId);
    }
    return {
        notificationId: created.notificationId,
        resolvedRecipients: resolvedRecipients.length,
        createdRecipients: created.userIds.length,
        skippedRecipients: resolvedRecipients.length - created.userIds.length,
    };
}
