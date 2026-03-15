import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { getTeacherTemplate, importTeacherBulk, previewTeacherBulk } from "./controller";

const teacherBulkImportRouter = Router();

teacherBulkImportRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:bulk-import"),
  importTeacherBulk
);
teacherBulkImportRouter.post(
  "/preview",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:bulk-import"),
  previewTeacherBulk
);
teacherBulkImportRouter.get(
  "/template",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:bulk-import"),
  getTeacherTemplate
);

export default teacherBulkImportRouter;
