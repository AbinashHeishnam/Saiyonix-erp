import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "@/utils/pagination";
import {
  createAcademicYear,
  deleteAcademicYear,
  getAcademicYearTransitionMeta,
  getActiveAcademicYear,
  getPreviousAcademicYear,
  getAcademicYearById,
  listAcademicYears,
  switchAcademicYear,
  updateAcademicYear,
} from "@/modules/academicYear/service";
import { academicYearIdSchema, switchAcademicYearSchema } from "@/modules/academicYear/validation";

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

  const parsed = academicYearIdSchema.safeParse(id);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }

  return parsed.data;
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await createAcademicYear(schoolId, req.body);
    return success(res, data, "Academic year created successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const pagination = parsePagination(req.query);
    const { items, total } = await listAcademicYears(schoolId, pagination);
    return success(
      res,
      items,
      "Academic years fetched successfully",
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
    const data = await getAcademicYearById(schoolId, id);
    return success(res, data, "Academic year fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await updateAcademicYear(schoolId, id, req.body);
    return success(res, data, "Academic year updated successfully");
  } catch (error) {
    return next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const id = parseId(req.params.id);
    const data = await deleteAcademicYear(schoolId, id);
    return success(res, data, "Academic year deleted successfully");
  } catch (error) {
    return next(error);
  }
}

export async function switchYear(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const parsed = switchAcademicYearSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid switch payload");
    }
    const data = await switchAcademicYear(schoolId, parsed.data, req.user?.sub);
    return success(res, data, "Academic year switched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function getActive(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await getActiveAcademicYear(schoolId);
    return success(res, data, "Active academic year fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function getPrevious(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await getPreviousAcademicYear(schoolId);
    return success(res, data, "Previous academic year fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function transitionMeta(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await getAcademicYearTransitionMeta(schoolId);
    return success(res, data, "Academic year transition metadata fetched successfully");
  } catch (error) {
    return next(error);
  }
}
