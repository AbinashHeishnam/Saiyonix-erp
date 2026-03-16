import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "../../core/errors/apiError";
import { success } from "../../utils/apiResponse";
import { buildPaginationMetaWithSync, parsePagination } from "../../utils/pagination";
import {
  createNotice as createNoticeService,
  deleteNotice as deleteNoticeService,
  getNoticeById as getNoticeByIdService,
  listNotices as listNoticesService,
  updateNotice as updateNoticeService,
} from "./service";
import { noticeIdSchema } from "./validation";

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

  const parsed = noticeIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }

  return parsed.data;
}

function parseBoolean(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === "true" || value === true) {
    return true;
  }

  if (value === "false" || value === false) {
    return false;
  }

  throw new ApiError(400, "Invalid boolean value");
}

function parseRole(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ApiError(400, "Invalid roleType");
  }

  const allowed = [
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "FINANCE_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT",
  ];

  if (!allowed.includes(value)) {
    throw new ApiError(400, "Invalid roleType");
  }

  return value;
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await createNoticeService(schoolId, req.body, req.user?.sub);
    return success(res, data, "Notice created successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const pagination = parsePagination(req.query);
    const noticeType =
      typeof req.query.noticeType === "string" ? req.query.noticeType : undefined;
    const active = parseBoolean(req.query.active);
    const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
    const sectionId =
      typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
    const roleType = parseRole(req.query.roleType);

    const { items, total } = await listNoticesService(
      schoolId,
      { noticeType, active, classId, sectionId, roleType },
      pagination
    );

    return success(
      res,
      items,
      "Notices fetched successfully",
      200,
      buildPaginationMetaWithSync(total, pagination)
    );
  } catch (error) {
    return next(error);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await getNoticeByIdService(schoolId, id);
    return success(res, data, "Notice fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await updateNoticeService(schoolId, id, req.body, req.user?.sub);
    return success(res, data, "Notice updated successfully");
  } catch (error) {
    return next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await deleteNoticeService(schoolId, id, req.user?.sub);
    return success(res, data, "Notice deleted successfully");
  } catch (error) {
    return next(error);
  }
}
