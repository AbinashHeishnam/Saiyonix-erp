import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "../../utils/apiError";
import { success } from "../../utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import {
  getStudentAttendanceById,
  listStudentAttendance,
  markStudentAttendance,
  updateStudentAttendance,
  type AttendanceFilters,
} from "./service";
import { studentAttendanceIdSchema } from "./validation";

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

  const parsed = studentAttendanceIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }

  return parsed.data;
}

function parseFilters(query: AuthRequest["query"]): AttendanceFilters {
  return {
    studentId: typeof query.studentId === "string" ? query.studentId : undefined,
    sectionId: typeof query.sectionId === "string" ? query.sectionId : undefined,
    academicYearId:
      typeof query.academicYearId === "string" ? query.academicYearId : undefined,
    fromDate: typeof query.fromDate === "string" ? query.fromDate : undefined,
    toDate: typeof query.toDate === "string" ? query.toDate : undefined,
  };
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await markStudentAttendance(schoolId, req.body, getActor(req));
    return success(res, data, "Attendance marked successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const pagination = parsePagination(req.query);
    const { items, total } = await listStudentAttendance(
      schoolId,
      parseFilters(req.query),
      pagination
    );
    return success(
      res,
      items,
      "Attendance records fetched successfully",
      200,
      buildPaginationMeta(total, pagination)
    );
  } catch (error) {
    return next(error);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await getStudentAttendanceById(schoolId, id);
    return success(res, data, "Attendance record fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await updateStudentAttendance(
      schoolId,
      id,
      req.body,
      getActor(req)
    );
    return success(res, data, "Attendance record updated successfully");
  } catch (error) {
    return next(error);
  }
}
