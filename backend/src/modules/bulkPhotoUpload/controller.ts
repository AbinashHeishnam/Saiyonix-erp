import type { Express, NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "../../core/errors/apiError";
import { success } from "../../utils/apiResponse";
import { processBulkPhotoZip } from "./service";

function getSchoolId(req: AuthRequest) {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  return req.schoolId;
}

export async function uploadBulkPhotos(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const schoolId = getSchoolId(req);
    const file = (req as AuthRequest & { file?: Express.Multer.File }).file;
    if (!file) {
      throw new ApiError(400, "ZIP file is required");
    }

    const result = await processBulkPhotoZip(schoolId, file.buffer);
    return success(res, result, "Bulk photos processed successfully");
  } catch (error) {
    return next(error);
  }
}
