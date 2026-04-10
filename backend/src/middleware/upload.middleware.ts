import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import path from "path";

import { uploadFile } from "@/core/storage/storage.service";
import { ALLOWED_FILE_TYPES } from "@/core/storage/constants";
import { logSecurity } from "@/core/security/logger";
import { ApiError } from "@/core/errors/apiError";

export type UploadedFileResult = {
  fileUrl: string;
  fileKey: string;
};

export type UploadOptions = {
  folder?: string;
  module?: string;
  userType?: "student" | "teacher" | "parent" | "common";
  userId?: string;
  userIdParam?: string;
  fieldName?: string;
  resolveUser?: (req: Request) => Promise<{ userType?: "student" | "teacher" | "parent" | "common"; userId?: string }> | { userType?: "student" | "teacher" | "parent" | "common"; userId?: string };
};

const memoryStorage = multer.memoryStorage();

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(ALLOWED_FILE_TYPES.mime);
const ALLOWED_EXTENSIONS = new Set(ALLOWED_FILE_TYPES.ext);

function sanitizeFileName(name: string) {
  const base = path.basename(name);
  const sanitized = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120);
  const trimmed = sanitized.replace(/^\.+/, "").replace(/^-+/, "").trim();
  return trimmed.length > 0 ? trimmed : "file";
}

export function uploadSingle(options: UploadOptions = {}) {
  const uploader = multer({
    storage: memoryStorage,
    limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
        logSecurity("blocked_file_type", { mimeType: file.mimetype });
        return cb(new ApiError(400, "File type not allowed"));
      }
      return cb(null, true);
    },
  }).single(options.fieldName ?? "file");

  return [
    uploader,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          return next();
        }

        req.file.originalname = sanitizeFileName(req.file.originalname);
        const roleType = (req as Request & { user?: { roleType?: string; sub?: string } }).user?.roleType;
        const resolvedUser = options.resolveUser ? await options.resolveUser(req) : {};
        const derivedUserType =
          resolvedUser.userType ??
          options.userType ??
          (roleType === "STUDENT"
            ? "student"
            : roleType === "TEACHER"
              ? "teacher"
              : roleType === "PARENT"
                ? "parent"
                : "common");
        const derivedUserId =
          resolvedUser.userId ??
          options.userId ??
          (options.userIdParam ? (req as Request & { params?: Record<string, string> }).params?.[options.userIdParam] : undefined) ??
          (req as Request & { user?: { sub?: string } }).user?.sub ??
          "shared";
        const moduleName = options.module ?? options.folder ?? "common";

        const uploaded = await uploadFile(req.file.buffer, {
          userType: derivedUserType,
          userId: derivedUserId,
          module: moduleName,
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
        });

        (req as Request & { uploadedFile?: UploadedFileResult }).uploadedFile = {
          fileUrl: uploaded.fileUrl,
          fileKey: uploaded.filePath,
        };
        return next();
      } catch (error) {
        return next(error);
      }
    },
  ];
}
