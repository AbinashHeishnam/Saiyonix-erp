import { AttendanceStatus, LeaveStatus, Prisma } from "@prisma/client";

import prisma from "../../core/db/prisma";
import { ApiError } from "../../core/errors/apiError";
import { buildDateRange, normalizeDate } from "../../core/utils/date";
import { logAudit } from "../../utils/audit";
import { trigger as triggerNotification } from "../notification/service";
import type { CreateStudentLeaveInput } from "./validation";

type ActorContext = {
  userId?: string;
  roleType?: string;
};

type StudentContext = {
  studentId: string;
  appliedByParentId: string | null;
};

type LeaveScope =
  | { type: "ALL" }
  | { type: "STUDENT_IDS"; studentIds: string[] };

function ensureActor(actor: ActorContext): { userId: string; roleType: string } {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  return { userId: actor.userId, roleType: actor.roleType };
}

async function resolveStudentContext(
  schoolId: string,
  actor: ActorContext,
  studentId?: string
): Promise<StudentContext> {
  const { userId, roleType } = ensureActor(actor);

  if (roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { schoolId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!student) {
      throw new ApiError(403, "Student account not linked");
    }

    return { studentId: student.id, appliedByParentId: null };
  }

  if (roleType === "PARENT") {
    const parent = await prisma.parent.findFirst({
      where: { schoolId, userId },
      select: { id: true },
    });

    if (!parent) {
      throw new ApiError(403, "Parent account not linked");
    }

    if (!studentId) {
      throw new ApiError(400, "studentId is required");
    }

    const link = await prisma.parentStudentLink.findFirst({
      where: {
        parentId: parent.id,
        studentId,
        student: { schoolId, deletedAt: null },
      },
      select: { id: true },
    });

    if (!link) {
      throw new ApiError(403, "Parent is not linked to this student");
    }

    return { studentId, appliedByParentId: parent.id };
  }

  if (roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN") {
    if (!studentId) {
      throw new ApiError(400, "studentId is required");
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId, deletedAt: null },
      select: { id: true },
    });

    if (!student) {
      throw new ApiError(400, "Student not found for this school");
    }

    return { studentId, appliedByParentId: null };
  }

  throw new ApiError(403, "Forbidden");
}

async function ensureNoOverlap(
  schoolId: string,
  studentId: string,
  fromDate: Date,
  toDate: Date
) {
  const existing = await prisma.studentLeave.findFirst({
    where: {
      studentId,
      status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
      fromDate: { lte: toDate },
      toDate: { gte: fromDate },
      student: { schoolId },
    },
    select: { id: true },
  });

  if (existing) {
    throw new ApiError(409, "Overlapping leave request exists");
  }
}

async function resolveStudentLeaveScope(
  schoolId: string,
  actor: ActorContext
): Promise<LeaveScope> {
  const { userId, roleType } = ensureActor(actor);

  if (roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN") {
    return { type: "ALL" };
  }

  if (roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { schoolId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!student) {
      throw new ApiError(403, "Student account not linked");
    }

    return { type: "STUDENT_IDS", studentIds: [student.id] };
  }

  if (roleType === "PARENT") {
    const parent = await prisma.parent.findFirst({
      where: { schoolId, userId },
      select: { id: true },
    });

    if (!parent) {
      throw new ApiError(403, "Parent account not linked");
    }

    const links = await prisma.parentStudentLink.findMany({
      where: { parentId: parent.id, student: { schoolId, deletedAt: null } },
      select: { studentId: true },
    });

    return { type: "STUDENT_IDS", studentIds: links.map((link) => link.studentId) };
  }

  if (roleType === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId, schoolId, deletedAt: null },
      select: { id: true },
    });

    if (!teacher) {
      throw new ApiError(403, "Teacher account not linked");
    }

    const sections = await prisma.section.findMany({
      where: { classTeacherId: teacher.id, deletedAt: null, class: { schoolId } },
      select: { id: true },
    });

    if (sections.length === 0) {
      return { type: "STUDENT_IDS", studentIds: [] };
    }

    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        sectionId: { in: sections.map((section) => section.id) },
        student: { schoolId, deletedAt: null },
      },
      select: { studentId: true },
    });

    const ids = Array.from(new Set(enrollments.map((item) => item.studentId)));
    return { type: "STUDENT_IDS", studentIds: ids };
  }

  throw new ApiError(403, "Forbidden");
}

async function ensureTeacherIsClassTeacher(
  schoolId: string,
  userId: string,
  studentId: string
) {
  const teacher = await prisma.teacher.findFirst({
    where: { userId, schoolId, deletedAt: null },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(403, "Teacher account not linked");
  }

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: { studentId, student: { schoolId, deletedAt: null } },
    orderBy: { createdAt: "desc" },
    select: { sectionId: true },
  });

  if (!enrollment) {
    throw new ApiError(400, "Student enrollment not found");
  }

  const section = await prisma.section.findFirst({
    where: {
      id: enrollment.sectionId,
      classTeacherId: teacher.id,
      deletedAt: null,
      class: { schoolId, deletedAt: null },
    },
    select: { id: true },
  });

  if (!section) {
    throw new ApiError(403, "Forbidden");
  }
}

async function resolveApproverUserIds(
  schoolId: string,
  studentId: string
): Promise<string[]> {
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: { studentId, student: { schoolId, deletedAt: null } },
    orderBy: { createdAt: "desc" },
    select: {
      section: {
        select: {
          classTeacher: { select: { userId: true } },
        },
      },
    },
  });

  const teacherUserId = enrollment?.section?.classTeacher?.userId ?? null;

  const adminUsers = await prisma.user.findMany({
    where: {
      schoolId,
      isActive: true,
      role: { roleType: { in: ["ADMIN", "ACADEMIC_SUB_ADMIN"] } },
    },
    select: { id: true },
  });

  const ids = adminUsers.map((user) => user.id);
  if (teacherUserId) {
    ids.push(teacherUserId);
  }

  return Array.from(new Set(ids));
}

function resolveRequesterUserId(leave: {
  student: { userId: string | null };
  appliedByParent: { userId: string | null } | null;
}): string | null {
  if (leave.appliedByParent?.userId) {
    return leave.appliedByParent.userId;
  }

  return leave.student.userId ?? null;
}

async function applyApprovedLeaveAttendance(
  schoolId: string,
  studentId: string,
  fromDate: Date,
  toDate: Date
): Promise<void> {
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: { studentId, student: { schoolId, deletedAt: null } },
    orderBy: { createdAt: "desc" },
    select: { sectionId: true, academicYearId: true },
  });

  if (!enrollment) {
    return;
  }

  const section = await prisma.section.findFirst({
    where: { id: enrollment.sectionId, deletedAt: null, class: { schoolId } },
    select: { classTeacherId: true },
  });

  if (!section?.classTeacherId) {
    return;
  }

  const slots = await prisma.timetableSlot.findMany({
    where: {
      sectionId: enrollment.sectionId,
      academicYearId: enrollment.academicYearId,
      section: { class: { schoolId, deletedAt: null }, deletedAt: null },
    },
    select: { id: true, dayOfWeek: true },
  });

  if (slots.length === 0) {
    return;
  }

  const slotByDay = new Map<number, string>();
  for (const slot of slots) {
    if (!slotByDay.has(slot.dayOfWeek)) {
      slotByDay.set(slot.dayOfWeek, slot.id);
    }
  }

  const dates = buildDateRange(fromDate, toDate);
  const existing = await prisma.studentAttendance.findMany({
    where: { studentId, attendanceDate: { in: dates }, student: { schoolId } },
    select: { attendanceDate: true },
  });

  const existingSet = new Set(
    existing.map((item) => normalizeDate(item.attendanceDate).toISOString())
  );

  const records = dates
    .map((date) => {
      const key = normalizeDate(date).toISOString();
      if (existingSet.has(key)) {
        return null;
      }
      const jsDay = date.getUTCDay();
      const day = jsDay === 0 ? 7 : jsDay;
      const timetableSlotId = slotByDay.get(day);
      if (!timetableSlotId) {
        return null;
      }
      return {
        studentId,
        academicYearId: enrollment.academicYearId,
        sectionId: enrollment.sectionId,
        timetableSlotId,
        attendanceDate: date,
        status: AttendanceStatus.EXCUSED,
        markedByTeacherId: section.classTeacherId!,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (records.length === 0) {
    return;
  }

  await prisma.studentAttendance.createMany({
    data: records,
    skipDuplicates: true,
  });
}

export async function createStudentLeave(
  schoolId: string,
  payload: CreateStudentLeaveInput,
  actor: ActorContext
): Promise<Prisma.StudentLeaveGetPayload<{}>> {
  const { userId } = ensureActor(actor);
  const context = await resolveStudentContext(schoolId, actor, payload.studentId);

  const fromDate = normalizeDate(payload.startDate);
  const toDate = normalizeDate(payload.endDate);

  if (toDate < fromDate) {
    throw new ApiError(400, "endDate must be on or after startDate");
  }

  await ensureNoOverlap(schoolId, context.studentId, fromDate, toDate);

  const leave = await prisma.studentLeave.create({
    data: {
      studentId: context.studentId,
      appliedByParentId: context.appliedByParentId,
      fromDate,
      toDate,
      reason: payload.reason,
      leaveType: payload.leaveType ?? null,
      status: LeaveStatus.PENDING,
    },
  });

  await logAudit({
    userId,
    action: "CREATE",
    entity: "StudentLeave",
    entityId: leave.id,
    metadata: {
      studentId: context.studentId,
      fromDate,
      toDate,
      leaveType: payload.leaveType ?? null,
    },
  });

  const approverIds = await resolveApproverUserIds(schoolId, context.studentId);
  if (approverIds.length > 0) {
    await triggerNotification("LEAVE_REQUEST_SUBMITTED", {
      schoolId,
      userIds: approverIds,
      title: "Leave Request Submitted",
      body: "A new student leave request is awaiting approval.",
      sentById: userId,
      metadata: {
        eventType: "LEAVE_REQUEST_SUBMITTED",
        leaveId: leave.id,
        studentId: context.studentId,
        leaveType: payload.leaveType ?? null,
      },
    });
  }

  return leave;
}

export async function listStudentLeaves(
  schoolId: string,
  actor: ActorContext,
  pagination?: { skip: number; take: number }
): Promise<{
  items: Prisma.StudentLeaveGetPayload<{
    select: {
      id: true;
      studentId: true;
      fromDate: true;
      toDate: true;
      reason: true;
      status: true;
      createdAt: true;
      updatedAt: true;
    };
  }>[];
  total: number;
}> {
  const scope = await resolveStudentLeaveScope(schoolId, actor);

  if (scope.type === "STUDENT_IDS" && scope.studentIds.length === 0) {
    return { items: [], total: 0 };
  }

  const where: Prisma.StudentLeaveWhereInput = {
    student: { schoolId },
    ...(scope.type === "STUDENT_IDS"
      ? { studentId: { in: scope.studentIds } }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.studentLeave.findMany({
      where,
      select: {
        id: true,
        studentId: true,
        fromDate: true,
        toDate: true,
        reason: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ createdAt: "desc" }],
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.studentLeave.count({ where }),
  ]);

  return { items, total };
}

export async function getStudentLeaveById(
  schoolId: string,
  id: string,
  actor: ActorContext
): Promise<
  Prisma.StudentLeaveGetPayload<{
    include: {
      student: { select: { id: true; userId: true } };
      appliedByParent: { select: { id: true; userId: true } };
    };
  }>
> {
  const leave = await prisma.studentLeave.findFirst({
    where: { id, student: { schoolId } },
    include: {
      student: { select: { id: true, userId: true } },
      appliedByParent: { select: { id: true, userId: true } },
    },
  });

  if (!leave) {
    throw new ApiError(404, "Leave request not found");
  }

  const { userId, roleType } = ensureActor(actor);

  if (roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN") {
    return leave;
  }

  if (roleType === "STUDENT") {
    if (leave.student.userId !== userId) {
      throw new ApiError(403, "Forbidden");
    }
    return leave;
  }

  if (roleType === "PARENT") {
    const parent = await prisma.parent.findFirst({
      where: { schoolId, userId },
      select: { id: true },
    });

    if (!parent) {
      throw new ApiError(403, "Parent account not linked");
    }

    const link = await prisma.parentStudentLink.findFirst({
      where: { parentId: parent.id, studentId: leave.student.id },
      select: { id: true },
    });

    if (!link) {
      throw new ApiError(403, "Forbidden");
    }

    return leave;
  }

  if (roleType === "TEACHER") {
    await ensureTeacherIsClassTeacher(schoolId, userId, leave.student.id);
    return leave;
  }

  throw new ApiError(403, "Forbidden");
}

async function updateStudentLeaveStatus(
  schoolId: string,
  id: string,
  actor: ActorContext,
  status: LeaveStatus
): Promise<Prisma.StudentLeaveGetPayload<{}>> {
  const leave = await prisma.studentLeave.findFirst({
    where: { id, student: { schoolId } },
    include: {
      student: { select: { id: true, userId: true } },
      appliedByParent: { select: { id: true, userId: true } },
    },
  });

  if (!leave) {
    throw new ApiError(404, "Leave request not found");
  }

  const { userId, roleType } = ensureActor(actor);

  if (roleType === "TEACHER") {
    await ensureTeacherIsClassTeacher(schoolId, userId, leave.student.id);
  } else if (roleType !== "ADMIN" && roleType !== "ACADEMIC_SUB_ADMIN") {
    throw new ApiError(403, "Forbidden");
  }

  if (leave.status !== LeaveStatus.PENDING) {
    throw new ApiError(400, "Leave request already processed");
  }

  const updated = await prisma.studentLeave.update({
    where: { id: leave.id },
    data: {
      status,
      approvedById: userId,
      approvedAt: new Date(),
    },
  });

  await logAudit({
    userId,
    action: status === LeaveStatus.APPROVED ? "APPROVE" : "REJECT",
    entity: "StudentLeave",
    entityId: leave.id,
    metadata: {
      studentId: leave.student.id,
      status,
    },
  });

  if (status === LeaveStatus.APPROVED) {
    await applyApprovedLeaveAttendance(
      schoolId,
      leave.student.id,
      leave.fromDate,
      leave.toDate
    );
  }

  const requesterUserId = resolveRequesterUserId(leave);
  if (requesterUserId) {
    await triggerNotification(
      status === LeaveStatus.APPROVED
        ? "LEAVE_REQUEST_APPROVED"
        : "LEAVE_REQUEST_REJECTED",
      {
        schoolId,
        userIds: [requesterUserId],
        title: `Leave ${status === LeaveStatus.APPROVED ? "Approved" : "Rejected"}`,
        body: `Your student leave request has been ${
          status === LeaveStatus.APPROVED ? "approved" : "rejected"
        }.`,
        sentById: userId,
        metadata: {
          eventType:
            status === LeaveStatus.APPROVED
              ? "LEAVE_REQUEST_APPROVED"
              : "LEAVE_REQUEST_REJECTED",
          leaveId: leave.id,
          studentId: leave.student.id,
          leaveType: leave.leaveType ?? null,
        },
      }
    );
  }

  return updated;
}

export async function approveStudentLeave(
  schoolId: string,
  id: string,
  actor: ActorContext
): Promise<Prisma.StudentLeaveGetPayload<{}>> {
  return updateStudentLeaveStatus(schoolId, id, actor, LeaveStatus.APPROVED);
}

export async function rejectStudentLeave(
  schoolId: string,
  id: string,
  actor: ActorContext
): Promise<Prisma.StudentLeaveGetPayload<{}>> {
  return updateStudentLeaveStatus(schoolId, id, actor, LeaveStatus.REJECTED);
}

export async function cancelStudentLeave(
  schoolId: string,
  id: string,
  actor: ActorContext
): Promise<Prisma.StudentLeaveGetPayload<{}>> {
  const leave = await prisma.studentLeave.findFirst({
    where: { id, student: { schoolId } },
    include: {
      student: { select: { id: true, userId: true } },
      appliedByParent: { select: { id: true, userId: true } },
    },
  });

  if (!leave) {
    throw new ApiError(404, "Leave request not found");
  }

  if (leave.status !== LeaveStatus.PENDING) {
    throw new ApiError(400, "Only pending leave can be cancelled");
  }

  const { userId, roleType } = ensureActor(actor);

  if (leave.appliedByParent?.userId) {
    if (roleType !== "PARENT" || leave.appliedByParent.userId !== userId) {
      throw new ApiError(403, "Forbidden");
    }
  } else {
    if (roleType !== "STUDENT" || leave.student.userId !== userId) {
      throw new ApiError(403, "Forbidden");
    }
  }

  const updated = await prisma.studentLeave.update({
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
    entity: "StudentLeave",
    entityId: leave.id,
    metadata: {
      studentId: leave.student.id,
      status: LeaveStatus.CANCELLED,
    },
  });

  const approverIds = await resolveApproverUserIds(schoolId, leave.student.id);
  if (approverIds.length > 0) {
    await triggerNotification("LEAVE_REQUEST_CANCELLED", {
      schoolId,
      userIds: approverIds,
      title: "Leave Request Cancelled",
      body: "A student leave request has been cancelled.",
      sentById: userId,
      metadata: {
        eventType: "LEAVE_REQUEST_CANCELLED",
        leaveId: leave.id,
        studentId: leave.student.id,
        leaveType: leave.leaveType ?? null,
      },
    });
  }

  return updated;
}

export async function getStudentLeaveTimeline(
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
  await getStudentLeaveById(schoolId, id, actor);

  const logs = await prisma.auditLog.findMany({
    where: { entity: "StudentLeave", entityId: id },
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
