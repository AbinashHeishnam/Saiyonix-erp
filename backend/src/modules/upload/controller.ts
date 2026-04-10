import type { NextFunction, Response } from "express";
import type { AuthRequest } from "@/middleware/auth.middleware";
import { success } from "@/utils/apiResponse";
import { uploadFileForModule, deleteStoredFile } from "@/modules/upload/service";
import { uploadBodySchema, deleteFileSchema } from "@/modules/upload/validation";
import { ApiError } from "@/core/errors/apiError";
import { basicRateLimit, rateLimitRedis } from "@/core/security/rateLimit";
import { logSecurity } from "@/core/security/logger";

export async function upload(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    try {
      const key = `upload:${req.user?.sub ?? req.ip ?? "unknown"}`;
      const redisCount = await rateLimitRedis(key, 5, 1);
      if (!redisCount && process.env.NODE_ENV !== "production") {
        basicRateLimit(key);
      }
    } catch (err) {
      logSecurity("rate_limit_upload", { userId: req.user?.sub ?? null, ip: req.ip ?? "unknown" });
      throw err;
    }
    const parsed = uploadBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid upload metadata");
    }

    if (!req.file) {
      throw new ApiError(400, "File is required");
    }

    const result = await uploadFileForModule(req.file, parsed.data);
    return success(res, result, "File uploaded successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const parsed = deleteFileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid delete payload");
    }
    const data = await deleteStoredFile(parsed.data.fileUrl, {
      userId: req.user?.sub,
      roleType: req.user?.roleType ?? (req.user as { role?: string } | undefined)?.role,
      schoolId: req.user?.schoolId,
    });
    return success(res, data, "File deleted successfully");
  } catch (error) {
    return next(error);
  }
}
