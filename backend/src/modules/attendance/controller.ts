import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "@/utils/pagination";
import prisma from "@/core/db/prisma";
import { normalizeDate } from "@/core/utils/date";
import { toLocalDateOnly } from "@/core/utils/localDate";
import { listAttendanceAuditLogs } from "@/modules/attendance/audit/service";
import { getSchoolAttendanceSummary, getStudentMonthlySummary } from "@/modules/attendance/summaries/service";
import {
  markAttendance,
  updateAttendance,
  getAttendanceBlockInfo,
  getClassTeacherAttendanceContext,
} from "@/modules/attendance/service";
import { attendanceIdSchema } from "@/modules/attendance/validation";

function getSchoolId(req: AuthRequest) {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  return req.schoolId;
}

function getActor(req: AuthRequest) {
  return {
    userId: req.user?.sub,
    roleType: req.user?.roleType,
  };
}

function parseId(id: unknown) {
  if (typeof id !== "string") {
    throw new ApiError(400, "Invalid id");
  }

  const parsed = attendanceIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }

  return parsed.data;
}

function ensureTeacherModelInitialized() {
  if (!(prisma as typeof prisma & { teacher?: unknown }).teacher) {
    throw new ApiError(500, "Prisma teacher model not initialized");
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);

    if (actor.roleType === "TEACHER") {
      if (!actor.userId) {
        throw new ApiError(401, "Unauthorized");
      }

      ensureTeacherModelInitialized();
      const teacher = await prisma.teacher.findFirst({
        where: { userId: actor.userId, schoolId, deletedAt: null },
        select: { id: true },
      });

      if (!teacher) {
        throw new ApiError(403, "Teacher account not linked");
      }

      const section = await prisma.section.findFirst({
        where: {
          classTeacherId: teacher.id,
          deletedAt: null,
          class: { schoolId, deletedAt: null },
        },
        orderBy: [{ class: { classOrder: "asc" } }, { sectionName: "asc" }],
        select: { id: true },
      });

      if (!section) {
        throw new ApiError(403, "Teacher is not assigned as class teacher");
      }

      const academicYear = await prisma.academicYear.findFirst({
        where: { schoolId, isActive: true },
        orderBy: { startDate: "desc" },
        select: { id: true },
      });

      if (!academicYear) {
        throw new ApiError(400, "Active academic year not found");
      }

      const payload = {
        ...req.body,
        sectionId: section.id,
        academicYearId: academicYear.id,
        attendanceDate: undefined,
      };

      const data = await markAttendance(schoolId, payload, actor);
      return success(res, data, "Attendance marked successfully", 201);
    }

    const data = await markAttendance(schoolId, req.body, actor);
    return success(res, data, "Attendance marked successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function attendanceContext(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);

    if (actor.roleType !== "TEACHER" || !actor.userId) {
      throw new ApiError(403, "Only teachers can access attendance context");
    }

    ensureTeacherModelInitialized();
    const teacher = await prisma.teacher.findFirst({
      where: { userId: actor.userId, schoolId, deletedAt: null },
      select: { id: true },
    });

    if (!teacher) {
      throw new ApiError(404, "Teacher not found");
    }

    const academicYear = await prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
      orderBy: { startDate: "desc" },
      select: { id: true },
    });

    if (!academicYear) {
      throw new ApiError(400, "Active academic year not found");
    }

    let section = await prisma.section.findFirst({
      where: {
        classTeacherId: teacher.id,
        deletedAt: null,
        class: { schoolId, deletedAt: null, academicYearId: academicYear.id },
      },
      select: {
        id: true,
        sectionName: true,
        classId: true,
        classTeacherId: true,
        class: { select: { className: true } },
      },
    });

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { startTime: true, endTime: true, timezone: true },
    });
    const timeZone = school?.timezone ?? "Asia/Kolkata";
    const todayLocal = new Date();
    const dateOnly = toLocalDateOnly(todayLocal, timeZone);

    if (!section) {
      const substitutions = await prisma.substitution.findMany({
        where: {
          substituteTeacherId: teacher.id,
          date: dateOnly,
          section: { class: { schoolId, deletedAt: null, academicYearId: academicYear.id }, deletedAt: null },
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
      const matched = substitutions.find((item) => {
        if (!item.section) return false;
        if (item.isClassTeacherSubstitution) return true;
        return item.absentTeacherId && item.absentTeacherId === item.section.classTeacherId;
      });
      if (matched?.section) {
        section = matched.section;
      }
    }

    if (!section) {
      throw new ApiError(403, "Only class teachers can access attendance context");
    }

    const alreadySubmitted = await prisma.sectionAttendance.findFirst({
      where: {
        sectionId: section.id,
        attendanceDate: dateOnly,
      },
      select: { id: true },
    });

    const getTimeZoneOffset = (date: Date) => {
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
    };

    const startTime = school?.startTime ?? "09:00";
    const endTime = school?.endTime ?? "14:45";
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = dtf.formatToParts(todayLocal);
    const map = new Map(parts.map((p) => [p.type, p.value]));
    const year = Number(map.get("year"));
    const month = Number(map.get("month"));
    const day = Number(map.get("day"));

    const startGuess = new Date(Date.UTC(year, month - 1, day, startH, startM));
    const startOffset = getTimeZoneOffset(startGuess);
    const windowStart = new Date(startGuess.getTime() - startOffset * 60000);

    const endGuess = new Date(Date.UTC(year, month - 1, day, endH, endM));
    const endOffset = getTimeZoneOffset(endGuess);
    const windowEnd = new Date(endGuess.getTime() - endOffset * 60000);

    let nextOpenAt: string | null = null;
    if (todayLocal < windowStart) {
      nextOpenAt = windowStart.toISOString();
    } else if (todayLocal > windowEnd) {
      const nextDay = new Date(todayLocal.getTime() + 24 * 60 * 60 * 1000);
      const nextParts = dtf.formatToParts(nextDay);
      const nextMap = new Map(nextParts.map((p) => [p.type, p.value]));
      const nextYear = Number(nextMap.get("year"));
      const nextMonth = Number(nextMap.get("month"));
      const nextDayNum = Number(nextMap.get("day"));
      const nextStartGuess = new Date(
        Date.UTC(nextYear, nextMonth - 1, nextDayNum, startH, startM)
      );
      const nextOffset = getTimeZoneOffset(nextStartGuess);
      const nextStart = new Date(nextStartGuess.getTime() - nextOffset * 60000);
      nextOpenAt = nextStart.toISOString();
    }

    const isSubstitute = section.classTeacherId !== teacher.id;
    const blockInfo = await getAttendanceBlockInfo({
      schoolId,
      academicYearId: academicYear.id,
      sectionId: section.id,
      attendanceDate: dateOnly,
    });

    const payload = {
      classId: section.classId,
      className: section.class?.className ?? null,
      sectionId: section.id,
      sectionName: section.sectionName,
      academicYearId: academicYear.id,
      date: dateOnly.toISOString(),
      timeSlot: "DEFAULT",
      alreadySubmitted: Boolean(alreadySubmitted),
      nextOpenAt,
      isOpen: todayLocal >= windowStart && todayLocal <= windowEnd,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      startTime,
      endTime,
      canMarkAttendance: blockInfo.allowed,
      blockReason: blockInfo.reason,
      holidayTitle: blockInfo.holiday,
      exam: blockInfo.exam,
      isSubstitute,
      substituteFor: isSubstitute ? section.classTeacherId ?? null : null,
    };

    return success(res, payload, "Attendance context fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await updateAttendance(schoolId, id, req.body, getActor(req));
    return success(res, data, "Attendance record updated successfully");
  } catch (error) {
    return next(error);
  }
}

export async function listAudit(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const attendanceId =
      typeof req.query.attendanceId === "string" ? req.query.attendanceId : undefined;
    const studentId =
      typeof req.query.studentId === "string" ? req.query.studentId : undefined;
    if ("page" in req.query || "limit" in req.query) {
      console.log("[Phase1] Pagination applied");
    }
    const pagination = parsePagination(req.query);
    const { items, total } = await listAttendanceAuditLogs(
      schoolId,
      { attendanceId, studentId },
      pagination
    );

    return success(
      res,
      items,
      "Attendance audit logs fetched successfully",
      200,
      buildPaginationMeta(total, pagination)
    );
  } catch (error) {
    return next(error);
  }
}

export async function studentMonthlySummary(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const studentId =
      typeof req.query.studentId === "string" ? req.query.studentId : undefined;
    const academicYearId =
      typeof req.query.academicYearId === "string"
        ? req.query.academicYearId
        : undefined;
    const monthRaw = typeof req.query.month === "string" ? req.query.month : undefined;
    const yearRaw = typeof req.query.year === "string" ? req.query.year : undefined;

    if (!studentId || !academicYearId || !monthRaw || !yearRaw) {
      throw new ApiError(400, "studentId, academicYearId, month, year are required");
    }

    const month = Number.parseInt(monthRaw, 10);
    const year = Number.parseInt(yearRaw, 10);
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      throw new ApiError(400, "Invalid month");
    }
    if (!Number.isFinite(year)) {
      throw new ApiError(400, "Invalid year");
    }

    const data = await getStudentMonthlySummary({
      schoolId,
      studentId,
      academicYearId,
      month,
      year,
    });

    return success(res, data, "Student attendance summary fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function schoolSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const academicYearId =
      typeof req.query.academicYearId === "string"
        ? req.query.academicYearId
        : undefined;
    const date = typeof req.query.date === "string" ? req.query.date : undefined;

    if (!academicYearId) {
      throw new ApiError(400, "academicYearId is required");
    }

    const data = await getSchoolAttendanceSummary({
      schoolId,
      academicYearId,
      date,
    });

    return success(res, data, "School attendance summary fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function teacherContext(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const data = await getClassTeacherAttendanceContext(schoolId, getActor(req));
    return success(res, data, "Class teacher attendance context fetched successfully");
  } catch (error) {
    return next(error);
  }
}
