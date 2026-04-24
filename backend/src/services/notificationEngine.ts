import type { Prisma, UserRole } from "@prisma/client";
import crypto from "crypto";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";

export type NotificationInput = {
  type: string;
  title: string;
  message: string;
  senderId: string;

  targetType: "ALL" | "ROLE" | "USER" | "CLASS";

  role?: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
  userIds?: string[];
  classId?: string;

  meta?: Record<string, any>;
};

export type NotificationDispatchResult = {
  notificationId: string | null;
  resolvedRecipients: number;
  createdRecipients: number;
  skippedRecipients: number;
};

type PushPayload = {
  type: string;
  title: string;
  message: string;
  meta?: Record<string, any>;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function uniq(ids: string[]) {
  return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim().length > 0)));
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(",")}}`;
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function resolveEntityId(input: NotificationInput): string {
  const meta = input.meta ?? {};
  const raw = (meta as Record<string, unknown>).entityId;
  if (raw !== null && raw !== undefined) {
    if (typeof raw === "string") return raw;
    if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
    try {
      return JSON.stringify(raw);
    } catch {
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

function mapRole(inputRole: NotificationInput["role"]): UserRole[] {
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

function resolveNotificationTypeEnum(eventType: string) {
  const upper = eventType.toUpperCase();
  if (upper.includes("ATTENDANCE")) return "ATTENDANCE" as const;
  if (upper.includes("NOTICE")) return "NOTICE" as const;
  return "GENERAL" as const;
}

function ensureValidTargetType(input: NotificationInput) {
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

async function ensureSenderContext(senderId: string) {
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { id: true, schoolId: true },
  });

  if (!sender) {
    throw new ApiError(404, "Sender not found");
  }

  return sender;
}

async function resolveClassStudentUserIds(params: {
  schoolId: string;
  classId: string;
  academicYearId: string | null;
  sectionId: string | null;
}) {
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
    .filter((id): id is string => Boolean(id));

  return { studentUserIds: uniq(studentUserIds), studentIds: uniq(studentIds) };
}

async function resolveParentUserIdsForStudents(params: { schoolId: string; studentIds: string[] }) {
  if (params.studentIds.length === 0) return [];

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
    .filter((id): id is string => Boolean(id));

  return uniq(userIds);
}

export async function resolveRecipients(input: NotificationInput): Promise<string[]> {
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

    const mapped = new Map<string, string>();
    for (const row of students) {
      if (row.userId) mapped.set(row.id, row.userId);
    }
    for (const row of parents) {
      if (row.userId) mapped.set(row.id, row.userId);
    }
    for (const row of teachers) {
      if (row.userId) mapped.set(row.id, row.userId);
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
    const academicYearId =
      typeof meta.academicYearId === "string"
        ? meta.academicYearId
        : (
            await prisma.academicYear.findFirst({
              where: { schoolId: sender.schoolId, isActive: true },
              select: { id: true },
            })
          )?.id ?? null;
    const sectionId = typeof meta.sectionId === "string" ? meta.sectionId : null;
    const includeParents = meta.includeParents === true;

    const { studentUserIds, studentIds } = await resolveClassStudentUserIds({
      schoolId: sender.schoolId,
      classId: input.classId as string,
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

async function getPushTokens(userIds: string[]) {
  return prisma.pushToken.findMany({
    where: {
      userId: { in: userIds },
      invalidatedAt: null,
      platform: "EXPO",
    },
    select: { token: true },
  });
}

function isExpoPushToken(token: string) {
  return /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9-]{10,}\]$/.test(token);
}

async function sendPushToUsers(tokens: string[], payload: PushPayload) {
  const validTokens = uniq(tokens).filter((token) => isExpoPushToken(token));
  if (!validTokens.length) return;

  console.log("[PUSH SEND] tokens:", validTokens.length);

  const title = typeof payload.title === "string" && payload.title.trim().length > 0 ? payload.title : "Notification";
  const body = typeof payload.message === "string" ? payload.message : "";

  const messages = validTokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    priority: "high",
    channelId: "default",
    data: payload.meta || {},
  }));

  const chunkSize = 100;
  for (let i = 0; i < messages.length; i += chunkSize) {
    const batch = messages.slice(i, i + chunkSize);

    let res: Response;
    try {
      res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });
    } catch (err) {
      console.error("[PUSH ERROR] fetch failed", err);
      continue;
    }

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    console.log("[PUSH RESPONSE]", JSON.stringify(json));

    const tickets = Array.isArray(json?.data) ? json.data : [];
    const deadTokens: string[] = [];
    for (let idx = 0; idx < tickets.length; idx += 1) {
      const ticket = tickets[idx];
      if (!ticket || typeof ticket !== "object") continue;
      if (ticket.status !== "error") continue;

      console.error("[PUSH ERROR]", (ticket as any).details);

      if ((ticket as any).details?.error === "DeviceNotRegistered") {
        const tokenFromDetails =
          typeof (ticket as any).details?.expoPushToken === "string"
            ? String((ticket as any).details.expoPushToken)
            : null;
        const tokenFromBatch = typeof (batch[idx] as any)?.to === "string" ? String((batch[idx] as any).to) : null;
        const dead = tokenFromDetails ?? tokenFromBatch;
        if (dead) deadTokens.push(dead);
      }
    }

    if (deadTokens.length > 0) {
      await prisma.pushToken.updateMany({
        where: { token: { in: uniq(deadTokens) } },
        data: { invalidatedAt: new Date() },
      });
    }
  }
}

export async function createAndDispatchNotification(
  input: NotificationInput
): Promise<NotificationDispatchResult> {
  ensureValidTargetType(input);
  console.info("[NOTIF ENGINE] type:", input.type);

  const sender = await ensureSenderContext(input.senderId);
  const resolvedRecipients = uniq(await resolveRecipients(input));
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
        metadata: meta as Prisma.InputJsonValue | undefined,
        sentVia: ["IN_APP"],
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
      return { notificationId: null as string | null, userIds: [] as string[] };
    }

    return { notificationId: record.id, userIds: insertedUserIds };
  });

  if (created.notificationId && created.userIds.length > 0) {
    console.log("[PUSH SEND] RECIPIENT USER IDS:", {
      count: created.userIds.length,
      sample: created.userIds.slice(0, 50),
    });

    const tokens = await getPushTokens(created.userIds);
    console.log("[PUSH SEND] TOKENS FOUND:", tokens.length);
    const tokenValues = tokens.map((t) => t.token).filter((t): t is string => Boolean(t));

    if (tokenValues.length === 0) {
      let diag: Record<string, unknown> | null = null;
      try {
        const [total, active, expoActive, byPlatform, sampleUsersWithAnyToken, sampleTokens] = await Promise.all([
          prisma.pushToken.count({ where: { userId: { in: created.userIds } } }),
          prisma.pushToken.count({ where: { userId: { in: created.userIds }, invalidatedAt: null } }),
          prisma.pushToken.count({
            where: { userId: { in: created.userIds }, invalidatedAt: null, platform: "EXPO" },
          }),
          prisma.pushToken.groupBy({ by: ["platform"], where: { userId: { in: created.userIds } }, _count: { platform: true } }),
          prisma.pushToken.findMany({
            where: { userId: { in: created.userIds } },
            distinct: ["userId"],
            select: { userId: true },
            take: 5,
          }),
          prisma.pushToken.findMany({
            where: { userId: { in: created.userIds.slice(0, 20) } },
            select: { userId: true, platform: true, invalidatedAt: true },
            take: 50,
          }),
        ]);

        diag = {
          tokenRowsTotal: total,
          tokenRowsActive: active,
          tokenRowsExpoActive: expoActive,
          tokenRowsByPlatform: byPlatform.map((row) => ({ platform: row.platform, count: row._count.platform })),
          sampleUsersWithAnyToken: sampleUsersWithAnyToken.map((r) => r.userId),
          sampleTokens,
        };
      } catch (err) {
        diag = { diagError: err instanceof Error ? err.message : String(err) };
      }

      console.warn("[PUSH SEND] No active tokens for recipients", {
        recipientCount: created.userIds.length,
        diag,
      });
    }

    const batches = chunk(tokenValues, 500);
    const payload: PushPayload = {
      type: input.type,
      title: input.title,
      message: input.message,
      meta: { ...(input.meta ?? {}), type: input.type },
    };

    for (const batch of batches) {
      await sendPushToUsers(batch, payload);
    }
  }

  return {
    notificationId: created.notificationId,
    resolvedRecipients: resolvedRecipients.length,
    createdRecipients: created.userIds.length,
    skippedRecipients: resolvedRecipients.length - created.userIds.length,
  };
}
