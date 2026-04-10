import type { NextFunction, Response } from "express";

import type { AuthRequest } from "@/middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import {
  bulkCreateTimetable,
  createSubstitution,
  deleteTimetableSlot,
  getSectionTimetable,
  getTimetableLockStatus,
  getTimetableWorkload,
  getTimetableMeta,
  getTimetableOptions,
  getParentTimetableForUser,
  getStudentTimetableForUser,
  getTeacherTimetable,
  getTeacherTodaySchedule,
  setTimetableLock,
  validateTimetableSlot,
} from "@/modules/timetable/service";

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

function getQueryString(value: unknown) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === "string" ? value : undefined;
}

export async function bulkCreate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await bulkCreateTimetable(schoolId, req.body);
    return success(res, data, "Timetable created successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function validateSlot(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await validateTimetableSlot(schoolId, req.body);
    return success(res, data, "Timetable slot is valid");
  } catch (error) {
    return next(error);
  }
}

export async function sectionTimetable(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const sectionId = getParamString(req.params.sectionId);
    if (!sectionId) {
      throw new ApiError(400, "sectionId is required");
    }
    const date = getQueryString(req.query.date);
    const data = await getSectionTimetable(schoolId, sectionId, date);
    return success(res, data, "Section timetable fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function teacherTimetable(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const teacherId = getParamString(req.params.teacherId);
    if (!teacherId) {
      throw new ApiError(400, "teacherId is required");
    }
    const academicYearId = getQueryString(req.query.academicYearId);
    const date = getQueryString(req.query.date);
    const data = await getTeacherTimetable(schoolId, teacherId, academicYearId, date);
    return success(res, data, "Teacher timetable fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function teacherToday(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const userId = req.user?.sub;
    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }
    const data = await getTeacherTodaySchedule(schoolId, userId);
    return success(res, data, "Today's timetable fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function studentTimetable(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const userId = req.user?.sub;
    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }
    const date = getQueryString(req.query.date);
    const data = await getStudentTimetableForUser(schoolId, userId, date);
    return success(res, data, "Student timetable fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function parentTimetable(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const userId = req.user?.sub;
    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }
    const date = getQueryString(req.query.date);
    const data = await getParentTimetableForUser(schoolId, userId, date);
    return success(res, data, "Parent timetable fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function deleteSlot(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await deleteTimetableSlot(schoolId, req.body);
    return success(res, data, "Timetable slot deleted successfully");
  } catch (error) {
    return next(error);
  }
}

export async function substitute(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await createSubstitution(schoolId, req.body);
    return success(res, data, "Substitution created successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function lockTimetable(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await setTimetableLock(schoolId, true);
    return success(res, data, "Timetable locked successfully");
  } catch (error) {
    return next(error);
  }
}

export async function unlockTimetable(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await setTimetableLock(schoolId, false);
    return success(res, data, "Timetable unlocked successfully");
  } catch (error) {
    return next(error);
  }
}

export async function timetableLockStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await getTimetableLockStatus(schoolId);
    return success(res, data, "Timetable lock status fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function timetableWorkload(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await getTimetableWorkload(schoolId);
    return success(res, data, "Timetable workload fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function timetableMeta(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const sectionId = getParamString(req.params.sectionId);
    if (!sectionId) {
      throw new ApiError(400, "sectionId is required");
    }
    const data = await getTimetableMeta(schoolId, sectionId);
    return success(res, data, "Timetable meta fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function timetableOptions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const classId = getQueryString(req.query.classId);
    const sectionId = getQueryString(req.query.sectionId);
    const academicYearId = getQueryString(req.query.academicYearId);
    if (!classId || !sectionId || !academicYearId) {
      throw new ApiError(400, "classId, sectionId and academicYearId are required");
    }
    const data = await getTimetableOptions(schoolId, { classId, sectionId, academicYearId });
    return success(res, data, "Timetable options fetched successfully");
  } catch (error) {
    return next(error);
  }
}
