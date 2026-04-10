import { Router } from "express";
import express from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { getStudentTemplate, importStudents, previewStudents } from "@/modules/studentBulkImport/controller";

const studentBulkImportRouter = Router();

studentBulkImportRouter.get(
  "/template",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("student:bulk-import"),
  getStudentTemplate
);
studentBulkImportRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("student:bulk-import"),
  express.raw({
    type: [
      "text/csv",
      "application/csv",
    ],
    limit: "10mb",
  }),
  importStudents
);
studentBulkImportRouter.post(
  "/preview",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("student:bulk-import"),
  express.raw({
    type: [
      "text/csv",
      "application/csv",
    ],
    limit: "10mb",
  }),
  previewStudents
);

export default studentBulkImportRouter;
