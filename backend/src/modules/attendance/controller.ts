import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "../../core/errors/apiError";
import { success } from "../../utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import { listAttendanceAuditLogs } from "./audit/service";
import { getSchoolAttendanceSummary, getStudentMonthlySummary } from "./summaries/service";
import { markAttendance, updateAttendance } from "./service";
import { attendanceIdSchema } from "./validation";

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

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await markAttendance(schoolId, req.body, getActor(req));
    return success(res, data, "Attendance marked successfully", 201);
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
