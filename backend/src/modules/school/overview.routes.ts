import { Router } from "express";

import { authMiddleware } from "@/middleware/auth.middleware";
import { allowRoles } from "@/middleware/rbac.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import { validate } from "@/middleware/validate.middleware";
import {
  getOverview,
  getPublicOverview,
  getPublicLogo,
  uploadLogo,
  updateOverview,
} from "@/modules/school/overview.controller";
import { updateSchoolOverviewSchema } from "@/modules/school/overview.validation";
import multer from "multer";
import path from "node:path";
import { ApiError } from "@/core/errors/apiError";
import { logSecurity } from "@/core/security/logger";

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]);
const ALLOWED_LOGO_EXT = new Set([".png", ".jpg", ".jpeg", ".svg"]);
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_LOGO_MIME.has(file.mimetype) || !ALLOWED_LOGO_EXT.has(ext)) {
      logSecurity("blocked_logo_type", { mimeType: file.mimetype });
      return cb(new ApiError(400, "Logo file type not allowed"));
    }
    return cb(null, true);
  },
});

const router = Router();

router.get("/overview/public", getPublicOverview);
router.get("/logo/public", getPublicLogo);

router.get(
  "/overview",
  authMiddleware,
  allowRoles(
    "ADMIN",
    "SUPER_ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "FINANCE_SUB_ADMIN",
    "TEACHER",
    "STUDENT",
    "PARENT"
  ),
  getOverview
);

router.patch(
  "/overview",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("settings:update"),
  validate(updateSchoolOverviewSchema),
  updateOverview
);

router.post(
  "/logo",
  authMiddleware,
  allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("settings:update"),
  logoUpload.single("logo"),
  uploadLogo
);

export default router;
