import { Router } from "express";
import express from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getById, list, remove, update, getTimetable, getClassTeacher, studentMe, getStudentIdCard, assignRollNumbersController, } from "@/modules/student/controller";
import { history } from "@/modules/student/history.controller";
import { getStudentTemplate, importStudents, previewStudents, } from "@/modules/studentBulkImport/controller";
import { createStudentSchema, listStudentQuerySchema, studentIdParamSchema, updateStudentSchema, rollAssignSchema, } from "@/modules/student/validation";
const studentRouter = Router();
studentRouter.get("/bulk-import/template", authMiddleware, allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"), requirePermission("student:bulk-import"), getStudentTemplate);
studentRouter.post("/bulk-import/preview", authMiddleware, allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"), requirePermission("student:bulk-import"), express.raw({
    type: ["text/csv", "application/csv"],
    limit: "10mb",
}), previewStudents);
studentRouter.post("/bulk-import", authMiddleware, allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"), requirePermission("student:bulk-import"), express.raw({
    type: ["text/csv", "application/csv"],
    limit: "10mb",
}), importStudents);
studentRouter.post("/", authMiddleware, allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"), requirePermission("student:create"), validate(createStudentSchema), create);
studentRouter.post("/roll-assign", authMiddleware, allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"), requirePermission("student:update"), validate({ body: rollAssignSchema }), assignRollNumbersController);
studentRouter.get("/me", authMiddleware, allowRoles("STUDENT"), studentMe);
studentRouter.get("/id-card", authMiddleware, allowRoles("STUDENT"), getStudentIdCard);
studentRouter.get("/class-teacher", authMiddleware, allowRoles("STUDENT", "PARENT"), getClassTeacher);
studentRouter.get("/:id/timetable", authMiddleware, allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER", "PARENT", "STUDENT"), requirePermission("timetableSlot:read"), validate({ params: studentIdParamSchema }), getTimetable);
studentRouter.get("/:id/history", authMiddleware, allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN", "TEACHER", "PARENT", "STUDENT"), validate({ params: studentIdParamSchema }), history);
studentRouter.get("/", authMiddleware, validate({ query: listStudentQuerySchema }), list);
studentRouter.get("/:id", authMiddleware, validate({ params: studentIdParamSchema }), getById);
studentRouter.patch("/:id", authMiddleware, allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"), requirePermission("student:update"), validate({ params: studentIdParamSchema, body: updateStudentSchema }), update);
studentRouter.delete("/:id", authMiddleware, allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"), requirePermission("student:delete"), validate({ params: studentIdParamSchema }), remove);
export default studentRouter;
