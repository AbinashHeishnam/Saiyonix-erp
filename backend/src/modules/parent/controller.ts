import type { NextFunction, Response } from "express";

import type { AuthRequest } from "@/middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import {
  getParentProfileById,
  getParentProfileByUserId,
  listParents,
  updateStudentPhotoByParentUserId,
  updateParentProfileById,
  updateParentProfileByUserId,
} from "@/modules/parent/service";
import { getStudentIdCardForParentUser } from "@/modules/student/service";
import { buildPaginationMeta, parsePagination } from "@/utils/pagination";

function getSchoolId(req: AuthRequest) {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  return req.schoolId;
}

export async function getParentProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const roleType = req.user?.roleType;
    if (!roleType) {
      throw new ApiError(401, "Unauthorized");
    }

    if (roleType === "PARENT") {
      const userId = req.user?.sub;
      if (!userId) {
        throw new ApiError(401, "Unauthorized");
      }
      const data = await getParentProfileByUserId(schoolId, userId);
      return success(res, data, "Parent profile fetched successfully");
    }

    throw new ApiError(403, "Forbidden");
  } catch (error) {
    return next(error);
  }
}

export async function updateParentProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const roleType = req.user?.roleType;
    if (!roleType) {
      throw new ApiError(401, "Unauthorized");
    }

    if (roleType === "PARENT") {
      const userId = req.user?.sub;
      if (!userId) {
        throw new ApiError(401, "Unauthorized");
      }
      const data = await updateParentProfileByUserId(schoolId, userId, req.body);
      return success(res, data, "Parent profile updated successfully");
    }

    throw new ApiError(403, "Forbidden");
  } catch (error) {
    return next(error);
  }
}

export async function adminGetParentProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const parentIdParam = req.params.id;
    const parentId = Array.isArray(parentIdParam) ? parentIdParam[0] : parentIdParam;
    if (!parentId) {
      throw new ApiError(400, "parentId is required");
    }
    const data = await getParentProfileById(schoolId, parentId);
    return success(res, data, "Parent profile fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function adminUpdateParentProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const parentIdParam = req.params.id;
    const parentId = Array.isArray(parentIdParam) ? parentIdParam[0] : parentIdParam;
    if (!parentId) {
      throw new ApiError(400, "parentId is required");
    }
    const data = await updateParentProfileById(schoolId, parentId, req.body);
    return success(res, data, "Parent profile updated successfully");
  } catch (error) {
    return next(error);
  }
}

export async function adminListParents(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const pagination = parsePagination(req.query);
    const { items, total } = await listParents(schoolId, pagination);
    return success(
      res,
      items,
      "Parents fetched successfully",
      200,
      buildPaginationMeta(total, pagination)
    );
  } catch (error) {
    return next(error);
  }
}

export async function getParentChildIdCard(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const userId = req.user?.sub;
    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }
    const data = await getStudentIdCardForParentUser(schoolId, userId);
    return success(res, data, "Child ID card fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function uploadParentStudentPhoto(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const roleType = req.user?.roleType;
    if (roleType !== "PARENT") {
      throw new ApiError(403, "Forbidden");
    }

    const userId = req.user?.sub;
    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    const studentIdParam = req.params.id;
    const studentId = Array.isArray(studentIdParam) ? studentIdParam[0] : studentIdParam;
    if (!studentId) {
      throw new ApiError(400, "studentId is required");
    }

    const uploadedFile = (req as AuthRequest & { uploadedFile?: { fileUrl: string } }).uploadedFile;
    if (!uploadedFile?.fileUrl) {
      throw new ApiError(400, "Photo file is required");
    }

    const data = await updateStudentPhotoByParentUserId(
      schoolId,
      userId,
      studentId,
      uploadedFile.fileUrl
    );
    return success(res, data, "Student photo updated");
  } catch (error) {
    return next(error);
  }
}
