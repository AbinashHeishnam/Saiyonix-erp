import type { NextFunction, Response } from "express";

import type { AuthRequest } from "@/middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import {
  addExamSchedule,
  addRoomAllocations,
  createExamAdmin,
  deleteExamSchedule,
  getExamRoutineForStudent,
  publishExamAdmin,
  unlockExamAdmin,
  setFinalExamAdmin,
  deleteExamAdmin,
} from "@/modules/examManagement/service";
import { examIdSchema, setFinalExamSchema } from "@/modules/examManagement/validation";

function getSchoolId(req: AuthRequest): string {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }
  return req.schoolId;
}

function getActor(req: AuthRequest): { userId: string; roleType: string } {
  const userId = req.user?.sub;
  const roleType = req.user?.roleType;

  if (!userId || !roleType) {
    throw new ApiError(401, "Unauthorized");
  }
  return { userId, roleType };
}

function parseId(id: unknown): string {
  if (typeof id !== "string") {
    throw new ApiError(400, "Invalid id");
  }
  const parsed = examIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }
  return parsed.data;
}

export async function adminCreateExam(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const data = await createExamAdmin(schoolId, req.body, actor);
    return success(res, data, "Exam created successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function adminAddSchedule(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const data = await addExamSchedule(schoolId, req.body, actor);
    return success(res, data, "Exam schedule saved successfully");
  } catch (error) {
    return next(error);
  }
}

export async function adminDeleteSchedule(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const data = await deleteExamSchedule(schoolId, req.body, actor);
    return success(res, data, "Exam schedule deleted successfully");
  } catch (error) {
    return next(error);
  }
}

export async function adminAddRoomAllocation(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const data = await addRoomAllocations(schoolId, req.body, actor);
    return success(res, data, "Room allocations saved successfully");
  } catch (error) {
    return next(error);
  }
}

export async function adminPublishExam(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await publishExamAdmin(schoolId, id, actor);
    return success(res, data, "Exam published successfully");
  } catch (error) {
    return next(error);
  }
}

export async function adminUnlockExam(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await unlockExamAdmin(schoolId, id, actor);
    return success(res, data, "Exam unlocked successfully");
  } catch (error) {
    return next(error);
  }
}

export async function adminSetFinalExam(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const parsed = setFinalExamSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid payload");
    }
    const data = await setFinalExamAdmin(schoolId, id, parsed.data, actor);
    return success(res, data, "Final exam updated successfully");
  } catch (error) {
    return next(error);
  }
}

export async function getStudentExamRoutine(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const data = await getExamRoutineForStudent(schoolId, actor);
    return success(res, data, "Exam routine fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function adminDeleteExam(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const actor = getActor(req);
    const id = parseId(req.params.id);
    const data = await deleteExamAdmin(schoolId, id, actor);
    return success(res, data, "Exam deleted successfully");
  } catch (error) {
    return next(error);
  }
}
