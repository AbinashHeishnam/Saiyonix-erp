import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "@/utils/pagination";
import {
  createTeacherSubjectClass,
  deleteTeacherSubjectClass,
  getTeacherSubjectClassById,
  getTeacherSubjectClasses,
  updateTeacherSubjectClass,
} from "@/modules/teacherSubjectClass/service";
import {
  teacherSubjectClassIdSchema,
  type TeacherSubjectClassFilters,
} from "@/modules/teacherSubjectClass/validation";

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

  const parsed = teacherSubjectClassIdSchema.safeParse(id);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }

  return parsed.data;
}

function parseFilters(query: AuthRequest["query"]): TeacherSubjectClassFilters {
  return {
    teacherId: typeof query.teacherId === "string" ? query.teacherId : undefined,
    classId: typeof query.classId === "string" ? query.classId : undefined,
    sectionId: typeof query.sectionId === "string" ? query.sectionId : undefined,
    academicYearId:
      typeof query.academicYearId === "string" ? query.academicYearId : undefined,
  };
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await createTeacherSubjectClass(schoolId, req.body);
    return success(res, data, "Teacher assignment created successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const pagination = parsePagination(req.query);
    const { items, total } = await getTeacherSubjectClasses(
      schoolId,
      parseFilters(req.query),
      pagination
    );
    return success(
      res,
      items,
      "Teacher assignments fetched successfully",
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
    const data = await getTeacherSubjectClassById(schoolId, id);
    return success(res, data, "Teacher assignment fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await updateTeacherSubjectClass(schoolId, id, req.body);
    return success(res, data, "Teacher assignment updated successfully");
  } catch (error) {
    return next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await deleteTeacherSubjectClass(schoolId, id);
    return success(res, data, "Teacher assignment deleted successfully");
  } catch (error) {
    return next(error);
  }
}
