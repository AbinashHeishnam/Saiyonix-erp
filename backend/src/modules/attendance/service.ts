import type { Prisma } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { getLocalDateParts, toLocalDateOnly } from "@/core/utils/localDate";
import { normalizeDate } from "@/core/utils/date";
import { cacheInvalidateByPrefix } from "@/core/cacheService";
import { safeRedisDel } from "@/core/cache/invalidate";
import {
  calculateAttendancePercentage,
  checkAttendanceThresholds,
  DEFAULT_ATTENDANCE_THRESHOLDS,
} from "@/core/risk/attendanceRisk";
import { chunkArray } from "@/core/utils/perf";
import { logAudit } from "@/utils/audit";
import { PRESENT_STATUSES } from "@/modules/attendance/summaries/service";
import type { AttendanceActor, AttendanceCounts } from "@/modules/attendance/types";
import { notifyAbsence, notifyAttendanceMarked, notifyThresholdDrop } from "@/modules/attendance/notifications";
import type { CreateAttendanceInput, UpdateAttendanceInput } from "@/modules/attendance/validation";
import { assertAttendanceAllowed, isAttendanceAllowed } from "@/modules/academicCalendar/service";

const DEFAULT_WINDOW_MINUTES = 120;

type DbClient = typeof prisma;

function ensureActor(actor: AttendanceActor): { userId: string; roleType: string } {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  return { userId: actor.userId, roleType: actor.roleType };
}

function ensureTeacherModelInitialized() {
  if (!(prisma as typeof prisma & { teacher?: unknown }).teacher) {
    throw new ApiError(500, "Prisma teacher model not initialized");
  }
}

function getTimeZoneOffset(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const map = new Map(parts.map((p) => [p.type, p.value]));
  const year = Number(map.get("year"));
  const month = Number(map.get("month"));
  const day = Number(map.get("day"));
  const hour = Number(map.get("hour"));
  const minute = Number(map.get("minute"));
  const second = Number(map.get("second"));
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return (asUtc - date.getTime()) / 60000;
}

function isSameLocalDate(a: Date, b: Date, timeZone: string) {
  const aParts = getLocalDateParts(a, timeZone);
  const bParts = getLocalDateParts(b, timeZone);
  return (
    aParts.year === bParts.year &&
    aParts.month === bParts.month &&
    aParts.day === bParts.day
  );
}

function resolveSchoolWindow(params: {
  timeZone: string;
  now: Date;
  startTime?: string | null;
  endTime?: string | null;
}) {
  const startValue = params.startTime ?? "09:00";
  const endValue = params.endTime ?? "14:45";

  const [startH, startM] = startValue.split(":").map(Number);
  const [endH, endM] = endValue.split(":").map(Number);
  if (
    Number.isNaN(startH) ||
    Number.isNaN(startM) ||
    Number.isNaN(endH) ||
    Number.isNaN(endM)
  ) {
    throw new ApiError(400, "Invalid school time configuration");
  }

  const { year, month, day } = getLocalDateParts(params.now, params.timeZone);
  const startGuess = new Date(Date.UTC(year, month - 1, day, startH, startM));
  const startOffset = getTimeZoneOffset(startGuess, params.timeZone);
  const windowStart = new Date(startGuess.getTime() - startOffset * 60000);

  const endGuess = new Date(Date.UTC(year, month - 1, day, endH, endM));
  const endOffset = getTimeZoneOffset(endGuess, params.timeZone);
  const windowEnd = new Date(endGuess.getTime() - endOffset * 60000);

  return {
    windowStart,
    windowEnd,
    startTime: startValue,
    endTime: endValue,
  };
}

function getLocalDayOfWeek(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  });
  const day = dtf.format(date);
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[day] ?? date.getDay();
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
    select: { id: true, classTeacherId: true, classId: true },
  });

  if (!section) {
    throw new ApiError(400, "Section not found for this school");
  }

  return section;
}

async function getExamAttendanceBlock(params: {
  schoolId: string;
  academicYearId: string;
  classId: string;
  attendanceDate: Date;
}) {
  const examSlot = await prisma.examTimetable.findFirst({
    where: {
      examDate: params.attendanceDate,
      examSubject: {
        exam: {
          schoolId: params.schoolId,
          academicYearId: params.academicYearId,
          isPublished: true,
        },
        classSubject: { classId: params.classId },
      },
    },
    select: {
      examSubject: {
        select: {
          exam: { select: { id: true, title: true } },
        },
      },
    },
  });

  if (!examSlot?.examSubject?.exam?.id) {
    return null;
  }

  return {
    examId: examSlot.examSubject.exam.id,
    examTitle: examSlot.examSubject.exam.title ?? "Exam",
  };
}

export async function getAttendanceBlockInfo(params: {
  schoolId: string;
  academicYearId: string;
  sectionId: string;
  attendanceDate: Date;
}) {
  const holidayCheck = await isAttendanceAllowed({
    academicYearId: params.academicYearId,
    attendanceDate: params.attendanceDate,
  });

  if (!holidayCheck.allowed) {
    const holiday = await prisma.academicCalendarEvent.findFirst({
      where: {
        academicYearId: params.academicYearId,
        affectsAttendance: true,
        eventType: { in: ["HOLIDAY", "TEMPORARY_HOLIDAY"] },
        startDate: { lte: params.attendanceDate },
        endDate: { gte: params.attendanceDate },
      },
      select: { title: true, eventType: true },
    });

    return {
      allowed: false,
      reason: holidayCheck.reason ?? "Attendance disabled due to holiday",
      holiday: holiday?.title ?? null,
      exam: null,
    };
  }

  const section = await prisma.section.findFirst({
    where: {
      id: params.sectionId,
      deletedAt: null,
      class: { schoolId: params.schoolId, deletedAt: null },
    },
    select: { classId: true },
  });
  if (!section) {
    return {
      allowed: false,
      reason: "Section not found",
      holiday: null,
      exam: null,
    };
  }

  const examBlock = await getExamAttendanceBlock({
    schoolId: params.schoolId,
    academicYearId: params.academicYearId,
    classId: section.classId,
    attendanceDate: params.attendanceDate,
  });

  if (examBlock) {
    return {
      allowed: false,
      reason: "Attendance disabled due to exam schedule",
      holiday: null,
      exam: examBlock,
    };
  }

  return { allowed: true, reason: null, holiday: null, exam: null };
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
  userId: string,
  attendanceDate: Date,
  timeZone: string
) {
  const teacher = await client.teacher.findFirst({
    where: { userId, schoolId, deletedAt: null },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(403, "Teacher account not linked");
  }

  const section = await client.section.findFirst({
    where: { id: sectionId, deletedAt: null },
    select: { id: true, classTeacherId: true },
  });

  if (!section) {
    throw new ApiError(404, "Section not found");
  }

  if (section.classTeacherId !== teacher.id) {
    const dateOnly = toLocalDateOnly(attendanceDate, timeZone);
    const substitution = await client.substitution.findFirst({
      where: {
        sectionId,
        date: dateOnly,
        substituteTeacherId: teacher.id,
      },
      select: { id: true, isClassTeacherSubstitution: true, absentTeacherId: true },
    });
    console.log({
      teacherId: teacher.id,
      sectionClassTeacher: section.classTeacherId,
      substitution,
      dateOnly,
    });
    const isClassTeacher = section.classTeacherId === teacher.id;
    const isValidSubstitute =
      substitution &&
      (substitution.isClassTeacherSubstitution === true ||
        substitution.absentTeacherId === section.classTeacherId);
    if (!isClassTeacher && !isValidSubstitute) {
      throw new ApiError(403, "Not allowed to mark attendance");
    }
  }

  return teacher.id;
}

async function getActiveAcademicYearId(client: DbClient, schoolId: string) {
  const academicYear = await client.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true },
  });

  if (!academicYear) {
    throw new ApiError(400, "Active academic year not found");
  }

  return academicYear.id;
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

async function findExistingStudentAttendance(
  client: DbClient,
  params: { studentIds: string[]; attendanceDate: Date }
) {
  return client.studentAttendance.findMany({
    where: {
      studentId: { in: params.studentIds },
      attendanceDate: params.attendanceDate,
    },
    select: { studentId: true },
  });
}

async function findSectionAttendance(
  client: DbClient,
  params: { sectionId: string; attendanceDate: Date }
) {
  return client.sectionAttendance.findFirst({
    where: {
      sectionId: params.sectionId,
      attendanceDate: params.attendanceDate,
    },
    select: { id: true },
  });
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
  timeZone: string;
  startTime?: string | null;
  endTime?: string | null;
}) {
  const now = new Date();
  if (!isSameLocalDate(params.attendanceDate, now, params.timeZone)) {
    throw new ApiError(403, "Attendance can only be marked for today");
  }

  const { windowStart, windowEnd, startTime, endTime } = resolveSchoolWindow({
    timeZone: params.timeZone,
    now,
    startTime: params.startTime,
    endTime: params.endTime,
  });

  if (now < windowStart || now > windowEnd) {
    throw new ApiError(
      403,
      `Attendance allowed only during school hours (${startTime} - ${endTime})`
    );
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

  let attendanceDate: Date = new Date();
  let timeZone = "Asia/Kolkata";
  const studentIds = payload.records.map((record) => record.studentId);

  const { warningLevels } = await getAttendanceSettings(prisma, schoolId);

  const created = await prisma.$transaction(async (tx) => {
    const db = tx as DbClient;
    if (!payload.sectionId) {
      throw new ApiError(400, "sectionId is required");
    }
    const sectionId = payload.sectionId;

    const school = await tx.school.findUnique({
      where: { id: schoolId },
      select: { startTime: true, endTime: true, timezone: true },
    });

    timeZone = school?.timezone ?? "Asia/Kolkata";
    attendanceDate = toLocalDateOnly(payload.attendanceDate, timeZone, () =>
      new ApiError(400, "Invalid attendanceDate")
    );

    const academicYearId =
      payload.academicYearId ?? (await getActiveAcademicYearId(db, schoolId));

    await ensureAcademicYearBelongsToSchool(db, schoolId, academicYearId);
    const section = await ensureSectionBelongsToSchool(db, schoolId, sectionId);

    await assertAttendanceAllowed({
      schoolId,
      academicYearId,
      attendanceDate,
    });

    const examBlock = await getExamAttendanceBlock({
      schoolId,
      academicYearId,
      classId: section.classId,
      attendanceDate,
    });
    if (examBlock) {
      throw new ApiError(403, "Attendance disabled due to exam schedule");
    }

    await enforceAttendanceWindow({
      client: db,
      schoolId,
      attendanceDate,
      timeZone,
      startTime: school?.startTime ?? null,
      endTime: school?.endTime ?? null,
    });

    const teacherId = await ensureTeacherIsClassTeacher(
      db,
      schoolId,
      sectionId,
      userId,
      attendanceDate,
      timeZone
    );

    const effectiveRows = await tx.timetableSlot.groupBy({
      by: ["sectionId"],
      where: {
        sectionId: payload.sectionId,
        academicYearId,
        effectiveFrom: { lte: attendanceDate },
      },
      _max: { effectiveFrom: true },
    });
    const effectiveFrom = effectiveRows[0]?._max.effectiveFrom ?? null;
    if (!effectiveFrom) {
      throw new ApiError(400, "No active timetable found for this date");
    }

    const dayOfWeek = getLocalDayOfWeek(new Date(), timeZone);
    const firstPeriodSlot = await tx.timetableSlot.findFirst({
      where: {
        sectionId: payload.sectionId,
        academicYearId,
        effectiveFrom,
        dayOfWeek,
        teacherId,
        period: { isFirstPeriod: true },
      },
      select: { id: true },
    });
    if (!firstPeriodSlot) {
      throw new ApiError(400, "No first-period timetable slot assigned to this class teacher");
    }

    const uniqueStudentIds = Array.from(new Set(studentIds));
    if (uniqueStudentIds.length !== studentIds.length) {
      throw new ApiError(400, "Duplicate studentId found in attendance records");
    }

    await ensureStudentsInSection(db, {
      studentIds: uniqueStudentIds,
      sectionId,
      academicYearId,
    });

    const existingAttendance = await findExistingStudentAttendance(db, {
      studentIds: uniqueStudentIds,
      attendanceDate,
    });
    if (existingAttendance.length === uniqueStudentIds.length) {
      throw new ApiError(409, "Attendance already marked for all students");
    }
    const existingSet = new Set(existingAttendance.map((item) => item.studentId));
    const recordsToCreate = payload.records.filter(
      (record) => !existingSet.has(record.studentId)
    );
    if (recordsToCreate.length === 0) {
      throw new ApiError(409, "Attendance already marked for all students");
    }

    const existingSection = await findSectionAttendance(db, {
      sectionId,
      attendanceDate,
    });
    if (!existingSection) {
      await tx.sectionAttendance.create({
        data: {
          sectionId: payload.sectionId,
          academicYearId,
          attendanceDate,
          markedByTeacherId: teacherId,
        },
      });
    }

    const entries: Awaited<ReturnType<typeof prisma.studentAttendance.create>>[] = [];

    const recordChunks = chunkArray(recordsToCreate, 50);
    for (const chunk of recordChunks) {
      const createdChunk = await Promise.all(
        chunk.map((record) =>
          tx.studentAttendance.create({
            data: {
              studentId: record.studentId,
              academicYearId,
              sectionId,
              attendanceDate,
              status: record.status,
              markedByTeacherId: teacherId,
              remarks: record.remarks,
            },
          })
        )
      );
      entries.push(...createdChunk);
    }

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
    await notifyAttendanceMarked({
      schoolId,
      studentId: entry.studentId,
      attendanceDate,
      status: entry.status,
      actorUserId: userId,
    });

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

  const auditChunks = chunkArray(created, 50);
  for (const chunk of auditChunks) {
    await Promise.all(
      chunk.map((entry) =>
        logAudit({
          userId,
          action: "MARK",
          entity: "StudentAttendance",
          entityId: entry.id,
          metadata: {
            studentId: entry.studentId,
            attendanceDate: toLocalDateOnly(attendanceDate, timeZone)
              .toISOString()
              .slice(0, 10),
            status: entry.status,
          },
        })
      )
    );
  }

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

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { timezone: true },
  });
  const timeZone = school?.timezone ?? "Asia/Kolkata";
  const today = toLocalDateOnly(undefined, timeZone);
  if (!isSameLocalDate(record.attendanceDate, today, timeZone)) {
    throw new ApiError(403, "Attendance edits allowed only on the same day");
  }

  const schoolWindow = resolveSchoolWindow({
    timeZone,
    now: new Date(),
  });
  const now = new Date();
  if (now < schoolWindow.windowStart || now > schoolWindow.windowEnd) {
    throw new ApiError(
      403,
      `Attendance edits allowed only during school hours (${schoolWindow.startTime} - ${schoolWindow.endTime})`
    );
  }

  await ensureTeacherIsClassTeacher(
    prisma,
    schoolId,
    record.sectionId,
    userId,
    record.attendanceDate,
    timeZone
  );

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

  try {
    const keys = [
      `attendance:student:${record.studentId}`,
      `attendance:section:${record.sectionId}`,
      `dashboard:student:${record.studentId}`,
    ];
    if (record.markedByTeacherId) {
      keys.push(`dashboard:teacher:${record.markedByTeacherId}`);
    }
    await safeRedisDel(keys);
  } catch {
    // ignore cache failures
  }
  return updated;
}

export async function getClassTeacherAttendanceContext(
  schoolId: string,
  actor: AttendanceActor
) {
  const { userId, roleType } = ensureActor(actor);
  if (roleType !== "TEACHER") {
    throw new ApiError(403, "Only class teachers can access this resource");
  }

  ensureTeacherModelInitialized();
  const teacher = await prisma.teacher.findFirst({
    where: { userId, schoolId, deletedAt: null },
    select: { id: true },
  });

  if (!teacher) {
    throw new ApiError(403, "Teacher account not linked");
  }

  const academicYearId = await getActiveAcademicYearId(prisma, schoolId);
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { timezone: true },
  });
  const timeZone = school?.timezone ?? "Asia/Kolkata";
  const today = toLocalDateOnly(new Date(), timeZone);

  const sections = await prisma.section.findMany({
    where: {
      classTeacherId: teacher.id,
      deletedAt: null,
      class: { schoolId, deletedAt: null, academicYearId },
    },
    select: {
      id: true,
      sectionName: true,
      classId: true,
      class: { select: { className: true } },
    },
    orderBy: { sectionName: "asc" },
  });

  if (sections.length === 0) {
    const substitutions = await prisma.substitution.findMany({
      where: {
        substituteTeacherId: teacher.id,
        date: today,
        section: { deletedAt: null, class: { schoolId, deletedAt: null, academicYearId } },
        OR: [{ isClassTeacherSubstitution: true }, { absentTeacherId: { not: null } }],
      },
      select: {
        isClassTeacherSubstitution: true,
        absentTeacherId: true,
        section: {
          select: {
            id: true,
            sectionName: true,
            classId: true,
            class: { select: { className: true } },
            classTeacherId: true,
          },
        },
      },
    });
    const mapped = substitutions
      .filter((item) => {
        if (!item.section) return false;
        if (item.isClassTeacherSubstitution) return true;
        return item.absentTeacherId && item.absentTeacherId === item.section.classTeacherId;
      })
      .map((item) => item.section)
      .filter((section): section is NonNullable<typeof section> => Boolean(section));
    if (mapped.length === 0) {
      return { academicYearId, sections: [] };
    }
    sections.push(...mapped);
  }

  const sectionIds = sections.map((section) => section.id);

  const [enrollments, slots] = await Promise.all([
    prisma.studentEnrollment.findMany({
      where: {
        sectionId: { in: sectionIds },
        academicYearId,
        student: { schoolId, deletedAt: null },
      },
      select: {
        studentId: true,
        sectionId: true,
        student: {
          select: {
            fullName: true,
            profile: { select: { profilePhotoUrl: true } },
          },
        },
      },
      orderBy: { student: { fullName: "asc" } },
    }),
    prisma.timetableSlot.findMany({
      where: {
        sectionId: { in: sectionIds },
        academicYearId,
        section: { deletedAt: null, class: { schoolId, deletedAt: null } },
      },
      select: {
        id: true,
        sectionId: true,
        dayOfWeek: true,
        effectiveFrom: true,
        period: { select: { periodNumber: true } },
        classSubject: { select: { subject: { select: { name: true } } } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { period: { periodNumber: "asc" } }],
    }),
  ]);

  const effectiveRows = await prisma.timetableSlot.groupBy({
    by: ["sectionId"],
    where: {
      sectionId: { in: sectionIds },
      academicYearId,
      effectiveFrom: { lte: today },
    },
    _max: { effectiveFrom: true },
  });
  const effectiveMap = new Map<string, Date>();
  effectiveRows.forEach((row) => {
    if (row.sectionId && row._max.effectiveFrom) {
      effectiveMap.set(row.sectionId, row._max.effectiveFrom);
    }
  });
  const filteredSlots = slots.filter((slot) => {
    const maxEffective = effectiveMap.get(slot.sectionId);
    return maxEffective ? slot.effectiveFrom.getTime() === maxEffective.getTime() : false;
  });

  const studentsBySection = new Map<
    string,
    Array<{ id: string; fullName: string | null; profilePhotoUrl?: string | null }>
  >();
  enrollments.forEach((enrollment) => {
    if (!studentsBySection.has(enrollment.sectionId)) {
      studentsBySection.set(enrollment.sectionId, []);
    }
    studentsBySection.get(enrollment.sectionId)?.push({
      id: enrollment.studentId,
      fullName: enrollment.student?.fullName ?? null,
      profilePhotoUrl: enrollment.student?.profile?.profilePhotoUrl ?? null,
    });
  });

  const slotsBySection = new Map<
    string,
    Array<{
      id: string;
      dayOfWeek: number;
      period?: { periodNumber?: number | null } | null;
      classSubject?: { subject?: { name?: string | null } | null } | null;
    }>
  >();
  filteredSlots.forEach((slot) => {
    if (!slotsBySection.has(slot.sectionId)) {
      slotsBySection.set(slot.sectionId, []);
    }
    slotsBySection.get(slot.sectionId)?.push(slot);
  });

  const payload = sections.map((section) => ({
    id: section.id,
    sectionName: section.sectionName,
    classId: section.classId,
    className: section.class?.className ?? null,
    students: studentsBySection.get(section.id) ?? [],
    timetableSlots: slotsBySection.get(section.id) ?? [],
  }));

  return { academicYearId, sections: payload };
}
