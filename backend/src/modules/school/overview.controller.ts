import type { NextFunction, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import mime from "mime-types";

import type { AuthRequest } from "@/middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { uploadFile } from "@/core/storage/storage.service";
import {
  getSchoolOverview,
  getPublicSchoolOverview,
  updateSchoolOverview,
} from "@/modules/school/overview.service";
import { downloadFile } from "@/services/storage/r2.service";
import { updateSchoolOverviewSchema } from "@/modules/school/overview.validation";

function getSchoolId(req: AuthRequest) {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }
  return req.schoolId;
}

export async function getOverview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const data = await getSchoolOverview(schoolId);
    return success(res, data, "School overview fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function getPublicOverview(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await getPublicSchoolOverview();
    return success(res, data, "School overview fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function getPublicLogo(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await getPublicSchoolOverview();
    const fileUrl = data.logoUrl;
    if (!fileUrl) {
      throw new ApiError(404, "Logo not found");
    }

    if (/^https?:\/\//i.test(fileUrl)) {
      return res.redirect(fileUrl);
    }

    if (fileUrl.startsWith("r2://")) {
      const withoutScheme = fileUrl.slice("r2://".length);
      const [bucket, ...rest] = withoutScheme.split("/");
      const key = rest.join("/");
      if (!bucket || !key || bucket !== process.env.R2_BUCKET_NAME) {
        throw new ApiError(400, "Invalid logo url");
      }

      const { stream, contentType, contentLength, eTag } = await downloadFile(key);
      const finalType = contentType ?? "application/octet-stream";
      res.setHeader("Content-Type", finalType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      if (contentLength !== null) {
        res.setHeader("Content-Length", contentLength.toString());
      }
      if (eTag) {
        res.setHeader("ETag", eTag);
      }
      stream.on("error", (err) => {
        if (!res.headersSent) {
          return next(err);
        }
        res.end();
      });
      return stream.pipe(res);
    }

    if (fileUrl.startsWith("/uploads") || fileUrl.startsWith("/storage")) {
      const absolutePath = path.join(process.cwd(), fileUrl.replace(/^\/+/, ""));
      if (!fs.existsSync(absolutePath)) {
        throw new ApiError(404, "Logo not found");
      }
      const contentType = mime.lookup(absolutePath) || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(absolutePath);
    }

    throw new ApiError(400, "Invalid logo url");
  } catch (error) {
    return next(error);
  }
}

export async function updateOverview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const parsed = updateSchoolOverviewSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ApiError(400, "Invalid payload");
    }
    const data = await updateSchoolOverview(schoolId, parsed.data);
    return success(res, data, "School overview updated successfully");
  } catch (error) {
    return next(error);
  }
}

function sanitizeFileName(name: string) {
  const base = name.replace(/^.*[\\/]/, "");
  const sanitized = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120);
  const trimmed = sanitized.replace(/^\.+/, "").replace(/^-+/, "").trim();
  return trimmed.length > 0 ? trimmed : "logo";
}

export async function uploadLogo(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const file = (req as AuthRequest & { file?: { buffer: Buffer; originalname: string; mimetype: string; size: number } }).file;
    if (!file) {
      throw new ApiError(400, "Logo file is required");
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new ApiError(413, "Logo must be 2MB or smaller");
    }

    const uploaded = await uploadFile(file.buffer, {
      userType: "common",
      userId: schoolId,
      module: "school-logo",
      fileName: sanitizeFileName(file.originalname),
      mimeType: file.mimetype,
      size: file.size,
    });

    return success(res, { logoUrl: uploaded.fileUrl }, "Logo uploaded successfully", 201);
  } catch (error) {
    return next(error);
  }
}
