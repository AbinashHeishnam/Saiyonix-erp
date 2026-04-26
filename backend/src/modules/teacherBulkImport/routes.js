import { Router } from "express";
import express from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { getFailedTeacherCsv, getTeacherTemplate, importTeacherBulk, previewTeacherBulk, } from "@/modules/teacherBulkImport/controller";
const teacherBulkImportRouter = Router();
teacherBulkImportRouter.post("/", authMiddleware, allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"), requirePermission("teacher:bulk-import"), express.raw({
    type: ["text/csv", "application/csv"],
    limit: "5mb",
}), importTeacherBulk);
teacherBulkImportRouter.post("/preview", authMiddleware, allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"), requirePermission("teacher:bulk-import"), express.raw({
    type: ["text/csv", "application/csv"],
    limit: "5mb",
}), previewTeacherBulk);
teacherBulkImportRouter.get("/template", authMiddleware, allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"), requirePermission("teacher:bulk-import"), getTeacherTemplate);
teacherBulkImportRouter.post("/failed-csv", authMiddleware, allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"), requirePermission("teacher:bulk-import"), getFailedTeacherCsv);
export default teacherBulkImportRouter;
