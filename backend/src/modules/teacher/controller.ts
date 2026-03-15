import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "../../utils/apiError";
import { success } from "../../utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import {
  createTeacher as createTeacherService,
  deleteTeacher as deleteTeacherService,
  getTeacherById as getTeacherByIdService,
  getTeachers as getTeachersService,
  updateTeacher as updateTeacherService,
  updateTeacherStatus as updateTeacherStatusService,
  getTeacherTimetable as getTeacherTimetableService,
} from "./service";
import { teacherIdSchema } from "./validation";

function getSchoolId(req: AuthRequest) {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  return req.schoolId;
}

function parseId(id: unknown) {
  if (typeof id !== "string") {
    throw new ApiError(400, "Invalid id");
  }

  const parsed = teacherIdSchema.safeParse(id);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }

  return parsed.data;
}

export async function createTeacher(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await createTeacherService(schoolId, req.body);
    return success(res, data, "Teacher created successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listTeachers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const pagination = parsePagination(req.query);
    const { items, total } = await getTeachersService(schoolId, pagination);
    return success(
      res,
      items,
      "Teachers fetched successfully",
      200,
      buildPaginationMeta(total, pagination)
    );
  } catch (error) {
    return next(error);
  }
}

export async function getTeacher(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await getTeacherByIdService(schoolId, id);
    return success(res, data, "Teacher fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function updateTeacher(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await updateTeacherService(schoolId, id, req.body);
    return success(res, data, "Teacher updated successfully");
  } catch (error) {
    return next(error);
  }
}

export async function deleteTeacher(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await deleteTeacherService(schoolId, id);
    return success(res, data, "Teacher deleted successfully");
  } catch (error) {
    return next(error);
  }
}

export async function updateTeacherStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await updateTeacherStatusService(schoolId, id, req.body);
    return success(res, data, "Teacher status updated successfully");
  } catch (error) {
    return next(error);
  }
}

export async function getTeacherTimetable(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await getTeacherTimetableService(schoolId, id);
    return success(res, data, "Teacher timetable fetched successfully");
  } catch (error) {
    return next(error);
  }
}
