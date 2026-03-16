import type { Prisma } from "@prisma/client";

import prisma from "../../../core/db/prisma";
import { ApiError } from "../../../core/errors/apiError";
import { normalizeDate } from "../../../core/utils/date";
import { logAudit } from "../../../utils/audit";
import { trigger as triggerNotification } from "../../notification/service";
import { PRESENT_STATUSES } from "../summaries/service";
import type { AttendanceActor, AttendanceCounts } from "../types";
import type {
  CreateCorrectionRequestInput,
  ReviewCorrectionInput,
} from "./validation";

const DEFAULT_WARNING_LEVELS = [85, 80, 75];

type DbClient = Prisma.TransactionClient | typeof prisma;

function ensureActor(actor: AttendanceActor): { userId: string; roleType: string } {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  return { userId: actor.userId, roleType: actor.roleType };
}

function isPresentStatus(status: string) {
  return PRESENT_STATUSES.includes(status as (typeof PRESENT_STATUSES)[number]);
}

async function getAttendanceSettings(client: DbClient, schoolId: string) {
  const settings = await client.systemSetting.findMany({
    where: {
      schoolId,
      settingKey: { in: ["ATTENDANCE_WARNING_LEVELS"] },
    },
    select: { settingKey: true, settingValue: true },
  });

  const byKey = new Map(settings.map((item) => [item.settingKey, item.settingValue]));
  const rawWarnings = byKey.get("ATTENDANCE_WARNING_LEVELS");
  const warningLevels = Array.isArray(rawWarnings)
    ? rawWarnings.filter((value) => typeof value === "number")
    : DEFAULT_WARNING_LEVELS;

  return {
    warningLevels: warningLevels.length > 0 ? warningLevels : DEFAULT_WARNING_LEVELS,
  };
}

async function getAttendanceCounts(
  client: DbClient,
  schoolId: string,
  studentId: string,
  academicYearId: string
): Promise<AttendanceCounts> {
  const [total, present] = await Promise.all([
    client.studentAttendance.count({
      where: {
        studentId,
        academicYearId,
        student: { schoolId, deletedAt: null },
        section: { class: { schoolId, deletedAt: null }, deletedAt: null },
      },
    }),
    client.studentAttendance.count({
      where: {
        studentId,
        academicYearId,
        status: { in: [...PRESENT_STATUSES] },
        student: { schoolId, deletedAt: null },
        section: { class: { schoolId, deletedAt: null }, deletedAt: null },
      },
    }),
  ]);

  return { total, present };
}

function computePercentage(counts: AttendanceCounts) {
  if (counts.total === 0) {
    return 0;
  }

  return Math.round((counts.present / counts.total) * 10000) / 100;
}

async function notifyThresholdDrops(params: {
  schoolId: string;
  studentId: string;
  before: AttendanceCounts;
  after: AttendanceCounts;
  warningLevels: number[];
  actorUserId: string;
}) {
  const beforePct = computePercentage(params.before);
  const afterPct = computePercentage(params.after);

  const thresholds = [...params.warningLevels].sort((a, b) => b - a);

  for (const threshold of thresholds) {
    if (beforePct >= threshold && afterPct < threshold) {
      await triggerNotification("STUDENT_ALERT", {
        schoolId: params.schoolId,
        studentId: params.studentId,
        title: "Attendance Warning",
        body:
          threshold === 75
            ? "Attendance dropped below 75%. Detention risk warning."
            : `Attendance dropped below ${threshold}%. Please monitor attendance.`,
        sentById: params.actorUserId,
        metadata: {
          eventType: "ATTENDANCE_THRESHOLD",
          threshold,
          beforePercentage: beforePct,
          afterPercentage: afterPct,
        },
      });
    }
  }
}

async function notifyAbsence(params: {
  schoolId: string;
  studentId: string;
  attendanceDate: Date;
  actorUserId: string;
}) {
  await triggerNotification("STUDENT_ALERT", {
    schoolId: params.schoolId,
    studentId: params.studentId,
    title: "Student Marked Absent",
    body: `Student marked absent on ${params.attendanceDate
      .toISOString()
      .slice(0, 10)}.`,
    sentById: params.actorUserId,
    metadata: {
      eventType: "ATTENDANCE_ABSENT",
      attendanceDate: params.attendanceDate.toISOString().slice(0, 10),
    },
  });
}

async function ensureTeacherIsClassTeacher(
  schoolId: string,
  sectionId: string,
  userId: string
) {
  const teacher = await prisma.teacher.findFirst({
    where: { userId, schoolId, deletedAt: null },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(403, "Teacher account not linked");
  }

  const section = await prisma.section.findFirst({
    where: { id: sectionId, classTeacherId: teacher.id, deletedAt: null },
    select: { id: true },
  });

  if (!section) {
    throw new ApiError(403, "Only class teacher can request correction");
  }
}

export async function requestAttendanceCorrection(
  schoolId: string,
  payload: CreateCorrectionRequestInput,
  actor: AttendanceActor
) {
  const { userId, roleType } = ensureActor(actor);
  if (roleType !== "TEACHER") {
    throw new ApiError(403, "Only class teacher can request correction");
  }

  const attendance = await prisma.studentAttendance.findFirst({
    where: {
      id: payload.attendanceId,
      student: { schoolId, deletedAt: null },
      section: { class: { schoolId, deletedAt: null }, deletedAt: null },
    },
    include: { section: true },
  });

  if (!attendance) {
    throw new ApiError(404, "Attendance record not found");
  }

  await ensureTeacherIsClassTeacher(schoolId, attendance.sectionId, userId);

  const today = normalizeDate(new Date());
  if (!attendance.attendanceDate || normalizeDate(attendance.attendanceDate) >= today) {
    throw new ApiError(400, "Use same-day edit for today\'s attendance");
  }

  const correction = await prisma.$transaction(async (tx) => {
    const created = await tx.attendanceCorrection.create({
      data: {
        attendanceId: attendance.id,
        oldStatus: attendance.status,
        newStatus: payload.newStatus,
        reason: payload.reason,
        status: "PENDING",
        requestedById: userId,
      },
    });

    await tx.attendanceAuditLog.create({
      data: {
        attendanceId: attendance.id,
        action: "CORRECTION_REQUESTED",
        metadata: {
          oldStatus: attendance.status,
          newStatus: payload.newStatus,
          reason: payload.reason,
        },
        actorUserId: userId,
      },
    });

    return created;
  });

  await logAudit({
    userId,
    action: "CORRECTION_REQUEST",
    entity: "AttendanceCorrection",
    entityId: correction.id,
    metadata: {
      attendanceId: attendance.id,
      oldStatus: attendance.status,
      newStatus: payload.newStatus,
      reason: payload.reason,
    },
  });

  return correction;
}

async function updateCorrectionStatus(
  schoolId: string,
  correctionId: string,
  actor: AttendanceActor,
  status: "APPROVED" | "REJECTED",
  payload?: ReviewCorrectionInput
) {
  const { userId, roleType } = ensureActor(actor);
  if (roleType !== "ADMIN" && roleType !== "ACADEMIC_SUB_ADMIN") {
    throw new ApiError(403, "Forbidden");
  }

  const correction = await prisma.attendanceCorrection.findFirst({
    where: {
      id: correctionId,
      attendance: {
        student: { schoolId, deletedAt: null },
        section: { class: { schoolId, deletedAt: null }, deletedAt: null },
      },
    },
    include: { attendance: true },
  });

  if (!correction) {
    throw new ApiError(404, "Correction request not found");
  }

  if (correction.status !== "PENDING") {
    throw new ApiError(400, "Correction request already processed");
  }

  const { warningLevels } = await getAttendanceSettings(prisma, schoolId);

  const result = await prisma.$transaction(async (tx) => {
    if (status === "APPROVED") {
      await tx.studentAttendance.update({
        where: { id: correction.attendanceId },
        data: { status: correction.newStatus },
      });
    }

    const updated = await tx.attendanceCorrection.update({
      where: { id: correction.id },
      data: {
        status,
        correctedById: userId,
        correctedAt: new Date(),
        reviewRemarks: payload?.remarks ?? null,
      },
    });

    await tx.attendanceAuditLog.create({
      data: {
        attendanceId: correction.attendanceId,
        action: status === "APPROVED" ? "CORRECTION_APPROVED" : "CORRECTION_REJECTED",
        metadata: {
          oldStatus: correction.oldStatus,
          newStatus: correction.newStatus,
          reason: correction.reason,
          remarks: payload?.remarks ?? null,
        },
        actorUserId: userId,
      },
    });

    return updated;
  });

  await logAudit({
    userId,
    action: status === "APPROVED" ? "CORRECTION_APPROVE" : "CORRECTION_REJECT",
    entity: "AttendanceCorrection",
    entityId: result.id,
    metadata: {
      attendanceId: correction.attendanceId,
      oldStatus: correction.oldStatus,
      newStatus: correction.newStatus,
      reason: correction.reason,
      remarks: payload?.remarks ?? null,
    },
  });

  if (status === "APPROVED") {
    const countsAfter = await getAttendanceCounts(
      prisma,
      schoolId,
      correction.attendance.studentId,
      correction.attendance.academicYearId
    );
    const before: AttendanceCounts = {
      total: countsAfter.total,
      present: Math.max(
        0,
        countsAfter.present - (isPresentStatus(correction.newStatus) ? 1 : 0) +
          (isPresentStatus(correction.oldStatus) ? 1 : 0)
      ),
    };

    await notifyThresholdDrops({
      schoolId,
      studentId: correction.attendance.studentId,
      before,
      after: countsAfter,
      warningLevels,
      actorUserId: userId,
    });

    if (correction.newStatus === "ABSENT") {
      await notifyAbsence({
        schoolId,
        studentId: correction.attendance.studentId,
        attendanceDate: correction.attendance.attendanceDate,
        actorUserId: userId,
      });
    }
  }

  return result;
}

export async function approveAttendanceCorrection(
  schoolId: string,
  correctionId: string,
  actor: AttendanceActor,
  payload?: ReviewCorrectionInput
) {
  return updateCorrectionStatus(schoolId, correctionId, actor, "APPROVED", payload);
}

export async function rejectAttendanceCorrection(
  schoolId: string,
  correctionId: string,
  actor: AttendanceActor,
  payload?: ReviewCorrectionInput
) {
  return updateCorrectionStatus(schoolId, correctionId, actor, "REJECTED", payload);
}
