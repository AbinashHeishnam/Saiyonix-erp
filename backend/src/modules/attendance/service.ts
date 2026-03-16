import type { Prisma } from "@prisma/client";

import prisma from "../../core/db/prisma";
import { ApiError } from "../../core/errors/apiError";
import { normalizeDate } from "../../core/utils/date";
import {
  calculateAttendancePercentage,
  checkAttendanceThresholds,
  DEFAULT_ATTENDANCE_THRESHOLDS,
} from "../../core/risk/attendanceRisk";
import { logAudit } from "../../utils/audit";
import { PRESENT_STATUSES } from "./summaries/service";
import type { AttendanceActor, AttendanceCounts } from "./types";
import { notifyAbsence, notifyThresholdDrop } from "./notifications";
import type { CreateAttendanceInput, UpdateAttendanceInput } from "./validation";

const DEFAULT_WINDOW_MINUTES = 120;

type DbClient = Prisma.TransactionClient | typeof prisma;

function ensureActor(actor: AttendanceActor): { userId: string; roleType: string } {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  return { userId: actor.userId, roleType: actor.roleType };
}

function toDateOnly(value?: string) {
  const raw = value ? new Date(value) : new Date();
  if (Number.isNaN(raw.getTime())) {
    throw new ApiError(400, "Invalid attendanceDate");
  }
  return normalizeDate(raw);
}

function isSameUtcDate(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function combineDateAndTime(date: Date, time: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      time.getUTCHours(),
      time.getUTCMinutes(),
      time.getUTCSeconds(),
      time.getUTCMilliseconds()
    )
  );
}

function isPresentStatus(status: string) {
  return PRESENT_STATUSES.includes(status as (typeof PRESENT_STATUSES)[number]);
}

async function ensureAcademicYearBelongsToSchool(
  client: DbClient,
  schoolId: string,
  academicYearId: string
) {
  const record = await client.academicYear.findFirst({
    where: { id: academicYearId, schoolId },
    select: { id: true },
  });

  if (!record) {
    throw new ApiError(400, "Academic year not found for this school");
  }
}

async function ensureSectionBelongsToSchool(
  client: DbClient,
  schoolId: string,
  sectionId: string
) {
  const section = await client.section.findFirst({
    where: {
      id: sectionId,
      deletedAt: null,
      class: { schoolId, deletedAt: null },
    },
    select: { id: true, classTeacherId: true },
  });

  if (!section) {
    throw new ApiError(400, "Section not found for this school");
  }

  return section;
}

async function ensureTimetableSlotBelongsToSection(
  client: DbClient,
  schoolId: string,
  timetableSlotId: string,
  sectionId: string,
  academicYearId: string
) {
  const slot = await client.timetableSlot.findFirst({
    where: {
      id: timetableSlotId,
      sectionId,
      academicYearId,
      section: { class: { schoolId, deletedAt: null }, deletedAt: null },
      classSubject: {
        class: { schoolId, deletedAt: null },
        subject: { schoolId },
      },
    },
    select: { id: true },
  });

  if (!slot) {
    throw new ApiError(400, "Timetable slot not found for this section");
  }
}

async function ensureTeacherIsClassTeacher(
  client: DbClient,
  schoolId: string,
  sectionId: string,
  userId: string
) {
  const teacher = await client.teacher.findFirst({
    where: { userId, schoolId, deletedAt: null },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(403, "Teacher account not linked");
  }

  const section = await client.section.findFirst({
    where: { id: sectionId, classTeacherId: teacher.id, deletedAt: null },
    select: { id: true },
  });

  if (!section) {
    throw new ApiError(403, "Only class teacher can mark attendance");
  }

  return teacher.id;
}

async function ensureStudentsInSection(
  client: DbClient,
  params: { studentIds: string[]; sectionId: string; academicYearId: string }
) {
  const enrollments = await client.studentEnrollment.findMany({
    where: {
      studentId: { in: params.studentIds },
      sectionId: params.sectionId,
      academicYearId: params.academicYearId,
    },
    select: { studentId: true },
  });

  const enrolledSet = new Set(enrollments.map((item) => item.studentId));
  const missing = params.studentIds.filter((id) => !enrolledSet.has(id));

  if (missing.length > 0) {
    throw new ApiError(400, "Some students are not enrolled in this section");
  }
}

async function ensureAttendanceNotMarked(
  client: DbClient,
  params: { studentIds: string[]; attendanceDate: Date }
) {
  const existing = await client.studentAttendance.findMany({
    where: {
      studentId: { in: params.studentIds },
      attendanceDate: params.attendanceDate,
    },
    select: { studentId: true },
  });

  if (existing.length > 0) {
    throw new ApiError(409, "Attendance already marked for some students");
  }
}

async function getSchoolStartTime(client: DbClient, schoolId: string) {
  const period = await client.period.findFirst({
    where: { schoolId, isFirstPeriod: true },
    orderBy: { startTime: "asc" },
    select: { startTime: true },
  });

  if (!period) {
    throw new ApiError(400, "School start time not configured");
  }

  return period.startTime;
}

async function getAttendanceSettings(client: DbClient, schoolId: string) {
  const settings = await client.systemSetting.findMany({
    where: {
      schoolId,
      settingKey: { in: ["ATTENDANCE_WINDOW_MINUTES", "ATTENDANCE_WARNING_LEVELS"] },
    },
    select: { settingKey: true, settingValue: true },
  });

  const byKey = new Map(settings.map((item) => [item.settingKey, item.settingValue]));

  const rawWindow = byKey.get("ATTENDANCE_WINDOW_MINUTES");
  const windowMinutes =
    typeof rawWindow === "number"
      ? rawWindow
      : typeof rawWindow === "string"
      ? Number.parseInt(rawWindow, 10)
      : DEFAULT_WINDOW_MINUTES;

  const rawWarnings = byKey.get("ATTENDANCE_WARNING_LEVELS");
  const warningLevels = Array.isArray(rawWarnings)
    ? rawWarnings.filter((value) => typeof value === "number")
    : [...DEFAULT_ATTENDANCE_THRESHOLDS];

  return {
    windowMinutes: Number.isFinite(windowMinutes) ? windowMinutes : DEFAULT_WINDOW_MINUTES,
    warningLevels:
      warningLevels.length > 0 ? warningLevels : [...DEFAULT_ATTENDANCE_THRESHOLDS],
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
  return calculateAttendancePercentage(counts.total, counts.present);
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

  const beforeLevel = checkAttendanceThresholds(beforePct).crossedLevel;
  const afterLevel = checkAttendanceThresholds(afterPct).crossedLevel;
  if (beforeLevel === afterLevel) {
    return;
  }

  const thresholds = [...params.warningLevels].sort((a, b) => b - a);

  for (const threshold of thresholds) {
    if (beforePct >= threshold && afterPct < threshold) {
      await notifyThresholdDrop({
        schoolId: params.schoolId,
        studentId: params.studentId,
        threshold,
        beforePercentage: beforePct,
        afterPercentage: afterPct,
        actorUserId: params.actorUserId,
      });
    }
  }
}

async function enforceAttendanceWindow(params: {
  client: DbClient;
  schoolId: string;
  attendanceDate: Date;
}) {
  const now = new Date();
  if (!isSameUtcDate(params.attendanceDate, normalizeDate(now))) {
    throw new ApiError(403, "Attendance can only be marked for today");
  }

  const { windowMinutes } = await getAttendanceSettings(params.client, params.schoolId);
  const startTime = await getSchoolStartTime(params.client, params.schoolId);
  const windowStart = combineDateAndTime(params.attendanceDate, startTime);
  const windowEnd = new Date(windowStart.getTime() + windowMinutes * 60 * 1000);

  if (now < windowStart || now > windowEnd) {
    throw new ApiError(403, "Attendance window is closed");
  }
}

export async function markAttendance(
  schoolId: string,
  payload: CreateAttendanceInput,
  actor: AttendanceActor
) {
  const { userId, roleType } = ensureActor(actor);
  if (roleType !== "TEACHER") {
    throw new ApiError(403, "Only class teacher can mark attendance");
  }

  const attendanceDate = toDateOnly(payload.attendanceDate);
  const studentIds = payload.records.map((record) => record.studentId);

  const { warningLevels } = await getAttendanceSettings(prisma, schoolId);

  const created = await prisma.$transaction(async (tx) => {
    await ensureAcademicYearBelongsToSchool(tx, schoolId, payload.academicYearId);
    await ensureSectionBelongsToSchool(tx, schoolId, payload.sectionId);
    await ensureTimetableSlotBelongsToSection(
      tx,
      schoolId,
      payload.timetableSlotId,
      payload.sectionId,
      payload.academicYearId
    );

    await enforceAttendanceWindow({
      client: tx,
      schoolId,
      attendanceDate,
    });

    const teacherId = await ensureTeacherIsClassTeacher(
      tx,
      schoolId,
      payload.sectionId,
      userId
    );

    await ensureStudentsInSection(tx, {
      studentIds,
      sectionId: payload.sectionId,
      academicYearId: payload.academicYearId,
    });

    await ensureAttendanceNotMarked(tx, { studentIds, attendanceDate });

    const entries = await Promise.all(
      payload.records.map((record) =>
        tx.studentAttendance.create({
          data: {
            studentId: record.studentId,
            academicYearId: payload.academicYearId,
            sectionId: payload.sectionId,
            timetableSlotId: payload.timetableSlotId,
            attendanceDate,
            status: record.status,
            markedByTeacherId: teacherId,
            remarks: record.remarks,
          },
        })
      )
    );

    await tx.attendanceAuditLog.createMany({
      data: entries.map((entry) => ({
        attendanceId: entry.id,
        action: "MARKED",
        metadata: {
          status: entry.status,
          remarks: entry.remarks,
          markedByTeacherId: teacherId,
        },
        actorUserId: userId,
      })),
    });

    return entries;
  });

  for (const entry of created) {
    if (entry.status === "ABSENT") {
      await notifyAbsence({
        schoolId,
        studentId: entry.studentId,
        attendanceDate,
        actorUserId: userId,
      });
    }

    const countsAfter = await getAttendanceCounts(
      prisma,
      schoolId,
      entry.studentId,
      entry.academicYearId
    );
    const before: AttendanceCounts = {
      total: Math.max(0, countsAfter.total - 1),
      present: Math.max(0, countsAfter.present - (isPresentStatus(entry.status) ? 1 : 0)),
    };

    await notifyThresholdDrops({
      schoolId,
      studentId: entry.studentId,
      before,
      after: countsAfter,
      warningLevels,
      actorUserId: userId,
    });
  }

  await Promise.all(
    created.map((entry) =>
      logAudit({
        userId,
        action: "MARK",
        entity: "StudentAttendance",
        entityId: entry.id,
        metadata: {
          studentId: entry.studentId,
          attendanceDate: attendanceDate.toISOString().slice(0, 10),
          status: entry.status,
        },
      })
    )
  );

  return created;
}

export async function updateAttendance(
  schoolId: string,
  attendanceId: string,
  payload: UpdateAttendanceInput,
  actor: AttendanceActor
) {
  const { userId, roleType } = ensureActor(actor);
  if (roleType !== "TEACHER") {
    throw new ApiError(403, "Only class teacher can edit attendance");
  }

  const record = await prisma.studentAttendance.findFirst({
    where: {
      id: attendanceId,
      student: { schoolId, deletedAt: null },
      section: { class: { schoolId, deletedAt: null }, deletedAt: null },
    },
    include: { section: true },
  });

  if (!record) {
    throw new ApiError(404, "Attendance record not found");
  }

  const today = normalizeDate(new Date());
  if (!isSameUtcDate(record.attendanceDate, today)) {
    throw new ApiError(403, "Attendance edits allowed only on the same day");
  }

  await ensureTeacherIsClassTeacher(prisma, schoolId, record.sectionId, userId);

  const { warningLevels } = await getAttendanceSettings(prisma, schoolId);

  const updated = await prisma.$transaction(async (tx) => {
    const updatedRecord = await tx.studentAttendance.update({
      where: { id: record.id },
      data: {
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.remarks !== undefined ? { remarks: payload.remarks } : {}),
      },
    });

    if (payload.status && payload.status !== record.status) {
      await tx.attendanceCorrection.create({
        data: {
          attendanceId: record.id,
          oldStatus: record.status,
          newStatus: payload.status,
          reason: payload.correctionReason ?? "Correction",
          correctedById: userId,
          status: "APPROVED",
          requestedById: userId,
        },
      });
    }

    await tx.attendanceAuditLog.create({
      data: {
        attendanceId: record.id,
        action: payload.status ? "STATUS_UPDATE" : "REMARKS_UPDATE",
        metadata: {
          status: payload.status,
          remarks: payload.remarks,
          correctionReason: payload.correctionReason,
        },
        actorUserId: userId,
      },
    });

    return updatedRecord;
  });

  await logAudit({
    userId,
    action: "UPDATE",
    entity: "StudentAttendance",
    entityId: updated.id,
    metadata: {
      studentId: updated.studentId,
      attendanceDate: (updated.attendanceDate ?? record.attendanceDate)
        .toISOString()
        .slice(0, 10),
      status: updated.status,
      remarks: updated.remarks,
      correctionReason: payload.correctionReason,
    },
  });

  if (payload.status && payload.status !== record.status) {
    const countsAfter = await getAttendanceCounts(
      prisma,
      schoolId,
      record.studentId,
      record.academicYearId
    );
    const before: AttendanceCounts = {
      total: countsAfter.total,
      present: Math.max(
        0,
        countsAfter.present - (isPresentStatus(payload.status) ? 1 : 0) +
          (isPresentStatus(record.status) ? 1 : 0)
      ),
    };

    await notifyThresholdDrops({
      schoolId,
      studentId: record.studentId,
      before,
      after: countsAfter,
      warningLevels,
      actorUserId: userId,
    });

    if (payload.status === "ABSENT") {
      await notifyAbsence({
        schoolId,
        studentId: record.studentId,
        attendanceDate: record.attendanceDate,
        actorUserId: userId,
      });
    }
  }

  return updated;
}
