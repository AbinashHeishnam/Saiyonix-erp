import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "../../utils/apiError";
import { success } from "../../utils/apiResponse";
import {
  createTeacherProfile,
  getTeacherProfileByTeacherId,
  updateTeacherProfile,
} from "./service";
import { teacherProfileTeacherIdSchema } from "./validation";

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
