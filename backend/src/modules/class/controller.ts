import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "../../utils/apiError";
import { success } from "../../utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination";
import {
  createClass,
  deleteClass,
  getClassById,
  listClasses,
  updateClass,
} from "./service";
import { classIdSchema } from "./validation";

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

  const parsed = classIdSchema.safeParse(id);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }

  return parsed.data;
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await createClass(schoolId, req.body);
    return success(res, data, "Class created successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const pagination = parsePagination(req.query);
    const { items, total } = await listClasses(schoolId, pagination);
    return success(
      res,
      items,
      "Classes fetched successfully",
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
    const data = await getClassById(schoolId, id);
    return success(res, data, "Class fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await updateClass(schoolId, id, req.body);
    return success(res, data, "Class updated successfully");
  } catch (error) {
    return next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await deleteClass(schoolId, id);
    return success(res, data, "Class deleted successfully");
  } catch (error) {
    return next(error);
  }
}
