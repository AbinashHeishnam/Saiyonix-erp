import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "../../core/errors/apiError";
import { success } from "../../utils/apiResponse";
import { importStudentsFromFile, previewStudentsFromFile } from "./service";
import { bulkImportQuerySchema } from "./validation";

function getSchoolId(req: AuthRequest) {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  return req.schoolId;
}

function resolveFileType(contentType?: string) {
  if (!contentType) {
    return null;
  }
  const normalized = contentType.toLowerCase();
  if (normalized.includes("text/csv") || normalized.includes("application/csv")) {
    return "csv" as const;
  }
  if (
    normalized.includes("spreadsheet") ||
    normalized.includes("excel") ||
    normalized.includes("application/vnd.ms-excel")
  ) {
    return "xlsx" as const;
  }
  return null;
}

export async function importStudents(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const fileType = resolveFileType(req.headers["content-type"]);

    if (!fileType) {
      throw new ApiError(400, "Unsupported file type");
    }

    if (!Buffer.isBuffer(req.body)) {
      throw new ApiError(400, "File payload is required");
    }

    const parsedQuery = bulkImportQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      throw new ApiError(400, "Invalid query parameters");
    }

    const batchSize = parsedQuery.data.batchSize ?? 50;

    const result = await importStudentsFromFile(schoolId, req.body, fileType, {
      batchSize,
    });

    return success(res, result, "Student bulk import completed", 201);
  } catch (error) {
    return next(error);
  }
}

export async function previewStudents(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const fileType = resolveFileType(req.headers["content-type"]);

    if (!fileType) {
      throw new ApiError(400, "Unsupported file type");
    }

    if (!Buffer.isBuffer(req.body)) {
      throw new ApiError(400, "File payload is required");
    }

    const result = await previewStudentsFromFile(schoolId, req.body, fileType);
    return success(res, result, "Student bulk import preview completed");
  } catch (error) {
    return next(error);
  }
}

export async function getStudentTemplate(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const template =
      "fullName,gender,dateOfBirth,classId,sectionId,rollNumber,parentName,parentPhone";
    return success(res, { template }, "Student import template generated");
  } catch (error) {
    return next(error);
  }
}
