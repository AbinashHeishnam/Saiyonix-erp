import type { NextFunction, Response } from "express";

import type { AuthRequest } from "@/middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { getTeacherHistory, getTeacherHistoryByUserId } from "@/modules/teacher/history.service";

function getSchoolId(req: AuthRequest) {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }
  return req.schoolId;
}

function getParamString(value: unknown) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === "string" ? value : undefined;
}

export async function teacherHistory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    if (!req.user?.sub) {
      throw new ApiError(401, "Unauthorized");
    }
    const data = await getTeacherHistoryByUserId(schoolId, req.user.sub);
    return success(res, data, "Teacher history fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function teacherHistoryById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const teacherId = getParamString(req.params.id);
    if (!teacherId) {
      throw new ApiError(400, "teacherId is required");
    }
    const data = await getTeacherHistory(schoolId, teacherId);
    return success(res, data, "Teacher history fetched successfully");
  } catch (error) {
    return next(error);
  }
}
