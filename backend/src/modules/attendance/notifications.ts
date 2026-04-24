import prisma from "@/core/db/prisma";
import { formatLocalDate } from "@/core/utils/localDate";
import { createAndDispatchNotification } from "@/services/notificationEngine";

async function resolveStudentAndParentUserIds(params: { schoolId: string; studentId: string }) {
  const student = await prisma.student.findFirst({
    where: { id: params.studentId, schoolId: params.schoolId, deletedAt: null, status: "ACTIVE" },
    select: { userId: true },
  });

  const studentUserId = student?.userId ?? null;
  if (!studentUserId) {
    return [];
  }

  const links = await prisma.parentStudentLink.findMany({
    where: {
      studentId: params.studentId,
      isActive: true,
      parent: { schoolId: params.schoolId, userId: { not: null } },
    },
    select: { parent: { select: { userId: true } } },
  });

  const parentUserIds = links
    .map((link) => link.parent.userId)
    .filter((id): id is string => Boolean(id));

  return Array.from(new Set([studentUserId, ...parentUserIds]));
}

export async function notifyAttendanceMarked(params: {
  schoolId: string;
  studentId: string;
  attendanceDate: Date;
  status: string;
  actorUserId: string;
}) {
  const school = await prisma.school.findUnique({
    where: { id: params.schoolId },
    select: { timezone: true },
  });
  const timeZone = school?.timezone ?? "Asia/Kolkata";
  const dateLabel = formatLocalDate(params.attendanceDate, timeZone);

  const statusLabel = String(params.status || "").toUpperCase();
  const message =
    statusLabel === "PRESENT"
      ? "Marked Present"
      : statusLabel === "ABSENT"
        ? "Marked Absent"
        : `Marked ${statusLabel || "Updated"}`;

  const userIds = await resolveStudentAndParentUserIds({
    schoolId: params.schoolId,
    studentId: params.studentId,
  });

  if (userIds.length === 0) {
    return;
  }

  await createAndDispatchNotification({
    type: "ATTENDANCE_MARKED",
    title: "Attendance Update",
    message,
    senderId: params.actorUserId,
    targetType: "USER",
    userIds,
    meta: {
      entityType: "ATTENDANCE",
      entityId: `attendance:${params.studentId}:${dateLabel}:MARKED`,
      studentId: params.studentId,
      status: statusLabel || params.status,
      date: dateLabel,
      eventType: statusLabel === "ABSENT" ? "ATTENDANCE_ABSENT" : "ATTENDANCE_MARKED",
      linkUrl: "/attendance",
    },
  });
}

export async function notifyAbsence(params: {
  schoolId: string;
  studentId: string;
  attendanceDate: Date;
  actorUserId: string;
}) {
  await notifyAttendanceMarked({
    schoolId: params.schoolId,
    studentId: params.studentId,
    attendanceDate: params.attendanceDate,
    status: "ABSENT",
    actorUserId: params.actorUserId,
  });
}

export async function notifyThresholdDrop(params: {
  schoolId: string;
  studentId: string;
  threshold: number;
  beforePercentage: number;
  afterPercentage: number;
  actorUserId: string;
}) {
  const school = await prisma.school.findUnique({
    where: { id: params.schoolId },
    select: { timezone: true },
  });
  const timeZone = school?.timezone ?? "Asia/Kolkata";
  const dateLabel = formatLocalDate(new Date(), timeZone);

  const userIds = await resolveStudentAndParentUserIds({
    schoolId: params.schoolId,
    studentId: params.studentId,
  });

  if (userIds.length === 0) {
    return;
  }

  await createAndDispatchNotification({
    type: "ATTENDANCE_MARKED",
    title: "Attendance Update",
    message:
      params.threshold === 75
        ? "Attendance threshold dropped below 75%"
        : `Attendance threshold dropped below ${params.threshold}%`,
    senderId: params.actorUserId,
    targetType: "USER",
    userIds,
    meta: {
      entityType: "ATTENDANCE",
      entityId: `attendance:${params.studentId}:${dateLabel}:THRESHOLD:${params.threshold}`,
      studentId: params.studentId,
      status: "WARNING",
      date: dateLabel,
      eventType: "ATTENDANCE_THRESHOLD",
      threshold: params.threshold,
      beforePercentage: params.beforePercentage,
      afterPercentage: params.afterPercentage,
      linkUrl: "/attendance",
    },
  });
}
