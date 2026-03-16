import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import prisma from "../../core/db/prisma";
import { ApiError } from "../../core/errors/apiError";
import { success } from "../../utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import {
  createStudent,
  deleteStudent,
  getStudentById,
  listStudents,
  updateStudent,
  getStudentTimetable as getStudentTimetableService,
} from "./service";
import { studentIdSchema } from "./validation";

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

  const parsed = studentIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }

  return parsed.data;
}

async function ensureStudentSelfAccess(
  req: AuthRequest,
  schoolId: string,
  studentId: string
) {
  const roleType = req.user?.roleType;
  if (!roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  if (roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        schoolId,
        userId: req.user?.sub,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!student) {
      throw new ApiError(403, "Forbidden: cannot access this student timetable");
    }
  }

  if (roleType === "PARENT") {
    const parent = await prisma.parent.findFirst({
      where: { schoolId, userId: req.user?.sub },
      select: { id: true },
    });

    if (!parent) {
      throw new ApiError(403, "Forbidden: parent account not linked");
    }

    const link = await prisma.parentStudentLink.findFirst({
      where: { parentId: parent.id, studentId },
      select: { id: true },
    });

    if (!link) {
      throw new ApiError(403, "Forbidden: cannot access this student timetable");
    }
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await createStudent(schoolId, req.body);
    return success(res, data, "Student created successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const pagination = parsePagination(req.query);
    const { items, total } = await listStudents(schoolId, pagination);
    return success(
      res,
      items,
      "Students fetched successfully",
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
    const data = await getStudentById(schoolId, id);
    return success(res, data, "Student fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await updateStudent(schoolId, id, req.body);
    return success(res, data, "Student updated successfully");
  } catch (error) {
    return next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await deleteStudent(schoolId, id);
    return success(res, data, "Student deleted successfully");
  } catch (error) {
    return next(error);
  }
}

export async function getTimetable(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    await ensureStudentSelfAccess(req, schoolId, id);
    const data = await getStudentTimetableService(schoolId, id);
    return success(res, data, "Student timetable fetched successfully");
  } catch (error) {
    return next(error);
  }
}
