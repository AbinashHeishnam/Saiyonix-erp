import { LeaveStatus, Prisma } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { normalizeDate } from "@/core/utils/date";
import { safeRedisDel } from "@/core/cache/invalidate";
import { logAudit } from "@/utils/audit";
import { trigger as triggerNotification } from "@/modules/notification/service";
import { generateSubstitutions } from "@/modules/substitution/service";
import type { ApplyTeacherLeaveInput, CreateTeacherLeaveInput } from "@/modules/teacherLeave/validation";

type ActorContext = {
  userId?: string;
  roleType?: string;
};

type LeaveScope =
  | { type: "ALL" }
  | { type: "TEACHER_ID"; teacherId: string };

function toSecureFileUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/api/v1/files/secure")) return value;
  return `/api/v1/files/secure?fileUrl=${encodeURIComponent(value)}`;
}

function ensureActor(actor: ActorContext): { userId: string; roleType: string } {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  return { userId: actor.userId, roleType: actor.roleType };
}

async function resolveTeacherIdForActor(
  schoolId: string,
  actor: ActorContext
): Promise<string> {
  const { userId, roleType } = ensureActor(actor);

  if (roleType !== "TEACHER") {
    throw new ApiError(403, "Forbidden");
  }

  const teacher = await prisma.teacher.findFirst({
    where: { userId, schoolId, deletedAt: null },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(403, "Teacher account not linked");
  }

  return teacher.id;
}

async function ensureNoOverlap(
  schoolId: string,
  teacherId: string,
  fromDate: Date,
  toDate: Date
) {
  const existing = await prisma.teacherLeave.findFirst({
    where: {
      teacherId,
      status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
      fromDate: { lte: toDate },
      toDate: { gte: fromDate },
      teacher: { schoolId, deletedAt: null },
    },
    select: { id: true },
  });

  if (existing) {
    throw new ApiError(409, "Overlapping leave request exists");
  }
}

async function resolveTeacherLeaveScope(
  schoolId: string,
  actor: ActorContext
): Promise<LeaveScope> {
  const { userId, roleType } = ensureActor(actor);

  if (roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN" || roleType === "SUPER_ADMIN") {
    return { type: "ALL" };
  }

  if (roleType === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId, schoolId, deletedAt: null },
      select: { id: true },
    });

    if (!teacher) {
      throw new ApiError(403, "Teacher account not linked");
    }

    return { type: "TEACHER_ID", teacherId: teacher.id };
  }

  throw new ApiError(403, "Forbidden");
}

async function resolveAdminUserIds(schoolId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      schoolId,
      isActive: true,
      role: { roleType: { in: ["ADMIN", "ACADEMIC_SUB_ADMIN"] } },
    },
    select: { id: true },
  });

  return users.map((user) => user.id);
}

export async function createTeacherLeave(
  schoolId: string,
  payload: CreateTeacherLeaveInput,
  actor: ActorContext
): Promise<Prisma.TeacherLeaveGetPayload<{}>> {
  const { userId } = ensureActor(actor);
  const teacherId = await resolveTeacherIdForActor(schoolId, actor);

  const fromDate = normalizeDate(payload.startDate);
  const toDate = normalizeDate(payload.endDate);

  if (toDate < fromDate) {
    throw new ApiError(400, "endDate must be on or after startDate");
  }

  await ensureNoOverlap(schoolId, teacherId, fromDate, toDate);

  const leave = await prisma.teacherLeave.create({
    data: {
      teacherId,
      fromDate,
      toDate,
      reason: payload.reason,
      leaveType: payload.leaveType ?? null,
      attachmentUrl: payload.attachmentUrl ?? null,
      status: LeaveStatus.PENDING,
    },
  });

  await logAudit({
    userId,
    action: "CREATE",
    entity: "TeacherLeave",
    entityId: leave.id,
    metadata: {
      teacherId,
      fromDate,
      toDate,
      leaveType: payload.leaveType ?? null,
    },
  });

  const approvers = await resolveAdminUserIds(schoolId);
  if (approvers.length > 0) {
    await triggerNotification("LEAVE_REQUEST_SUBMITTED", {
      schoolId,
      userIds: approvers,
      title: "Leave Request Submitted",
      body: "A new teacher leave request is awaiting approval.",
      sentById: userId,
      entityType: "TEACHER_LEAVE",
      entityId: leave.id,
      linkUrl: "/admin/teacher-leaves",
      metadata: {
        eventType: "LEAVE_REQUEST_SUBMITTED",
        leaveId: leave.id,
        teacherId,
        leaveType: payload.leaveType ?? null,
        routes: {
          ADMIN: "/admin/teacher-leaves",
          ACADEMIC_SUB_ADMIN: "/admin/teacher-leaves",
        },
      },
    });
  }

  return leave;
}

export async function applyTeacherLeave(
  schoolId: string,
  payload: ApplyTeacherLeaveInput,
  actor: ActorContext
): Promise<Prisma.TeacherLeaveGetPayload<{}>> {
  const mapped: CreateTeacherLeaveInput = {
    startDate: payload.fromDate,
    endDate: payload.toDate,
    reason: payload.reason,
    leaveType: payload.leaveType,
    attachmentUrl: payload.attachmentUrl,
  };

  return createTeacherLeave(schoolId, mapped, actor);
}

export async function listTeacherLeaves(
  schoolId: string,
  actor: ActorContext,
  pagination?: { skip: number; take: number }
): Promise<{
  items: Prisma.TeacherLeaveGetPayload<{
    select: {
      id: true;
      teacherId: true;
      teacher: { select: { id: true; fullName: true; employeeId: true } };
      fromDate: true;
      toDate: true;
      reason: true;
      leaveType: true;
      status: true;
      attachmentUrl: true;
      adminRemarks: true;
      approvedAt: true;
      approvedById: true;
      createdAt: true;
      updatedAt: true;
    };
  }>[];
  total: number;
}> {
  const scope = await resolveTeacherLeaveScope(schoolId, actor);

  const where: Prisma.TeacherLeaveWhereInput = {
    teacher: { schoolId, deletedAt: null },
    ...(scope.type === "TEACHER_ID" ? { teacherId: scope.teacherId } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.teacherLeave.findMany({
      where,
      select: {
        id: true,
        teacherId: true,
        teacher: { select: { id: true, fullName: true, employeeId: true, photoUrl: true } },
        fromDate: true,
        toDate: true,
        reason: true,
        leaveType: true,
        status: true,
        attachmentUrl: true,
        adminRemarks: true,
        approvedAt: true,
        approvedById: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ createdAt: "desc" }],
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.teacherLeave.count({ where }),
  ]);

  const mapped = items.map((item) => ({
    ...item,
    attachmentUrl: toSecureFileUrl(item.attachmentUrl),
  }));
  return { items: mapped, total };
}

export async function getTeacherLeaveById(
  schoolId: string,
  id: string,
  actor: ActorContext
): Promise<
  Prisma.TeacherLeaveGetPayload<{
    include: { teacher: { select: { id: true; userId: true } } };
  }>
> {
  const leave = await prisma.teacherLeave.findFirst({
    where: { id, teacher: { schoolId, deletedAt: null } },
    include: { teacher: { select: { id: true, userId: true } } },
  });

  if (!leave) {
    throw new ApiError(404, "Leave request not found");
  }

  const { userId, roleType } = ensureActor(actor);

  if (roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN") {
    return { ...leave, attachmentUrl: toSecureFileUrl(leave.attachmentUrl) };
  }

  if (roleType === "TEACHER") {
    if (leave.teacher.userId !== userId) {
      throw new ApiError(403, "Forbidden");
    }
    return { ...leave, attachmentUrl: toSecureFileUrl(leave.attachmentUrl) };
  }

  throw new ApiError(403, "Forbidden");
}

async function updateTeacherLeaveStatus(
  schoolId: string,
  id: string,
  actor: ActorContext,
  status: LeaveStatus,
  remarks?: string
): Promise<Prisma.TeacherLeaveGetPayload<{}>> {
  const leave = await prisma.teacherLeave.findFirst({
    where: { id, teacher: { schoolId, deletedAt: null } },
    include: { teacher: { select: { id: true, userId: true } } },
  });

  if (!leave) {
    throw new ApiError(404, "Leave request not found");
  }

  const { userId, roleType } = ensureActor(actor);

  if (
    roleType !== "ADMIN" &&
    roleType !== "ACADEMIC_SUB_ADMIN" &&
    roleType !== "SUPER_ADMIN"
  ) {
    throw new ApiError(403, "Forbidden");
  }

  if (leave.status !== LeaveStatus.PENDING) {
    throw new ApiError(400, "Leave request already processed");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const db = tx as typeof prisma;
    const updatedLeave = await tx.teacherLeave.update({
      where: { id: leave.id },
      data: {
        status,
        approvedById: userId,
        approvedAt: new Date(),
        ...(remarks !== undefined ? { adminRemarks: remarks } : {}),
      },
    });

    if (status === LeaveStatus.APPROVED) {
      await generateSubstitutions(db, {
        schoolId,
        teacherId: leave.teacher.id,
        fromDate: leave.fromDate,
        toDate: leave.toDate,
        createdById: userId,
      });
    }

    return updatedLeave;
  });

  await logAudit({
    userId,
    action: status === LeaveStatus.APPROVED ? "APPROVE" : "REJECT",
    entity: "TeacherLeave",
    entityId: leave.id,
    metadata: {
      teacherId: leave.teacher.id,
      status,
      remarks: remarks ?? null,
    },
  });

  if (leave.teacher.userId) {
    await triggerNotification(
      status === LeaveStatus.APPROVED
        ? "LEAVE_REQUEST_APPROVED"
        : "LEAVE_REQUEST_REJECTED",
      {
        schoolId,
        userIds: [leave.teacher.userId],
        title: `Leave ${status === LeaveStatus.APPROVED ? "Approved" : "Rejected"}`,
        body: `Your leave request has been ${
          status === LeaveStatus.APPROVED ? "approved" : "rejected"
        }.`,
        sentById: userId,
        entityType: "TEACHER_LEAVE",
        entityId: leave.id,
        linkUrl: "/teacher/leave",
        metadata: {
          eventType:
            status === LeaveStatus.APPROVED
              ? "LEAVE_REQUEST_APPROVED"
              : "LEAVE_REQUEST_REJECTED",
          leaveId: leave.id,
          teacherId: leave.teacher.id,
          leaveType: leave.leaveType ?? null,
          routes: {
            TEACHER: "/teacher/leave",
          },
        },
      }
    );
  }

  try {
    const keys = [`leave:teacher:${leave.teacher.id}`];
    if (leave.teacher.userId) {
      keys.push(`leave:user:${leave.teacher.userId}`);
    }
    keys.push(`dashboard:teacher:${leave.teacher.id}`);
    await safeRedisDel(keys);
  } catch {
    // ignore cache failures
  }

  return updated;
}

export async function approveTeacherLeave(
  schoolId: string,
  id: string,
  actor: ActorContext
): Promise<Prisma.TeacherLeaveGetPayload<{}>> {
  return updateTeacherLeaveStatus(schoolId, id, actor, LeaveStatus.APPROVED);
}

export async function rejectTeacherLeave(
  schoolId: string,
  id: string,
  actor: ActorContext
): Promise<Prisma.TeacherLeaveGetPayload<{}>> {
  return updateTeacherLeaveStatus(schoolId, id, actor, LeaveStatus.REJECTED);
}

export async function adminUpdateTeacherLeaveStatus(
  schoolId: string,
  id: string,
  actor: ActorContext,
  status: LeaveStatus,
  remarks?: string
): Promise<Prisma.TeacherLeaveGetPayload<{}>> {
  return updateTeacherLeaveStatus(schoolId, id, actor, status, remarks);
}

export async function cancelTeacherLeave(
  schoolId: string,
  id: string,
  actor: ActorContext
): Promise<Prisma.TeacherLeaveGetPayload<{}>> {
  const leave = await prisma.teacherLeave.findFirst({
    where: { id, teacher: { schoolId, deletedAt: null } },
    include: { teacher: { select: { id: true, userId: true } } },
  });

  if (!leave) {
    throw new ApiError(404, "Leave request not found");
  }

  if (leave.status !== LeaveStatus.PENDING) {
    throw new ApiError(400, "Only pending leave can be cancelled");
  }

  const { userId, roleType } = ensureActor(actor);
  if (roleType !== "TEACHER" || leave.teacher.userId !== userId) {
    throw new ApiError(403, "Forbidden");
  }

  const updated = await prisma.teacherLeave.update({
    where: { id: leave.id },
    data: {
      status: LeaveStatus.CANCELLED,
      approvedById: null,
      approvedAt: null,
    },
  });

  await logAudit({
    userId,
    action: "CANCEL",
    entity: "TeacherLeave",
    entityId: leave.id,
    metadata: {
      teacherId: leave.teacher.id,
      status: LeaveStatus.CANCELLED,
    },
  });

  const approvers = await resolveAdminUserIds(schoolId);
  if (approvers.length > 0) {
    await triggerNotification("LEAVE_REQUEST_CANCELLED", {
      schoolId,
      userIds: approvers,
      title: "Leave Request Cancelled",
      body: "A teacher leave request has been cancelled.",
      sentById: userId,
      entityType: "TEACHER_LEAVE",
      entityId: leave.id,
      linkUrl: "/admin/teacher-leaves",
      metadata: {
        eventType: "LEAVE_REQUEST_CANCELLED",
        leaveId: leave.id,
        teacherId: leave.teacher.id,
        leaveType: leave.leaveType ?? null,
        routes: {
          ADMIN: "/admin/teacher-leaves",
          ACADEMIC_SUB_ADMIN: "/admin/teacher-leaves",
        },
      },
    });
  }

  return updated;
}

export async function getTeacherLeaveTimeline(
  schoolId: string,
  id: string,
  actor: ActorContext
): Promise<
  {
    action: string;
    actorUserId: string | null;
    createdAt: Date;
    metadata: Prisma.JsonValue | null;
  }[]
> {
  await getTeacherLeaveById(schoolId, id, actor);

  const logs = await prisma.auditLog.findMany({
    where: { entity: "TeacherLeave", entityId: id },
    orderBy: { createdAt: "asc" },
    select: { action: true, userId: true, createdAt: true, metadata: true },
  });

  return logs.map((log) => ({
    action: log.action,
    actorUserId: log.userId ?? null,
    createdAt: log.createdAt,
    metadata: log.metadata ?? null,
  }));
}
