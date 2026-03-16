import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "../../core/errors/apiError";
import { success } from "../../utils/apiResponse";
import { importTeachers, previewTeachers } from "./service";

function getSchoolId(req: AuthRequest) {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  return req.schoolId;
}

export async function importTeacherBulk(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const data = await importTeachers(schoolId, req.body);
    return success(res, data, "Teacher import completed");
  } catch (error) {
    return next(error);
  }
}

export async function previewTeacherBulk(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const data = await previewTeachers(schoolId, req.body);
    return success(res, data, "Teacher import preview completed");
  } catch (error) {
    return next(error);
  }
}

export async function getTeacherTemplate(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const template =
      "fullName,employeeId,gender,designation,department,joiningDate,qualification,phone,email,address,photoUrl";
    return success(res, { template }, "Teacher import template generated");
  } catch (error) {
    return next(error);
  }
}
