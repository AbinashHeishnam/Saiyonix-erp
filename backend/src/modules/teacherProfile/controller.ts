import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "@/utils/pagination";
import {
  createTeacherProfile,
  getTeacherProfileByTeacherId,
  listTeacherProfiles,
  updateTeacherProfile,
} from "@/modules/teacherProfile/service";
import { teacherProfileTeacherIdSchema } from "@/modules/teacherProfile/validation";

function getSchoolId(req: AuthRequest) {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  return req.schoolId;
}

function parseTeacherId(value: unknown) {
  if (typeof value !== "string") {
    throw new ApiError(400, "Invalid teacherId");
  }

  const parsed = teacherProfileTeacherIdSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid teacherId");
  }

  return parsed.data;
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await createTeacherProfile(schoolId, req.body);
    return success(res, data, "Teacher profile created successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function getByTeacherId(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const teacherId = parseTeacherId(req.params.teacherId);
    const data = await getTeacherProfileByTeacherId(schoolId, teacherId);
    return success(res, data, "Teacher profile fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function update(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const teacherId = parseTeacherId(req.params.teacherId);
    const data = await updateTeacherProfile(schoolId, teacherId, req.body);
    return success(res, data, "Teacher profile updated successfully");
  } catch (error) {
    return next(error);
  }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const pagination = parsePagination(req.query);
    const { items, total } = await listTeacherProfiles(schoolId, pagination);
    return success(
      res,
      items,
      "Teacher profiles fetched successfully",
      200,
      buildPaginationMeta(total, pagination)
    );
  } catch (error) {
    return next(error);
  }
}
