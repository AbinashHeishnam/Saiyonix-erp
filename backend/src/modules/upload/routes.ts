import { Router } from "express";
import multer from "multer";

import { authMiddleware } from "@/middleware/auth.middleware";
import { allowRoles } from "@/middleware/rbac.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import { upload, remove } from "@/modules/upload/controller";
import { ALLOWED_FILE_TYPES } from "@/core/storage/constants";
import { logSecurity } from "@/core/security/logger";

const router = Router();

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(ALLOWED_FILE_TYPES.mime);
const ALLOWED_EXTENSIONS = new Set(ALLOWED_FILE_TYPES.ext);

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname ? file.originalname.toLowerCase().split(".").pop() : "";
    const extWithDot = ext ? `.${ext}` : "";
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(extWithDot)) {
      logSecurity("file_validation_triggered", { mimeType: file.mimetype });
      return cb(new Error("File type not allowed"));
    }
    return cb(null, true);
  },
});

router.post(
  "/",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "FINANCE_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  requirePermission("file:write"),
  uploadMiddleware.single("file"),
  upload
);

router.delete(
  "/",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "FINANCE_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  requirePermission("file:write"),
  remove
);

export default router;
