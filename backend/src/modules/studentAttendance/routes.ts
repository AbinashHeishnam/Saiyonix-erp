import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { allowOnlyClassTeacher } from "@/middleware/classTeacher.middleware";
import { create, getById, list, update } from "@/modules/studentAttendance/controller";
import {
  createStudentAttendanceSchema,
  listStudentAttendanceQuerySchema,
  studentAttendanceIdParamSchema,
  updateStudentAttendanceSchema,
} from "@/modules/studentAttendance/validation";

const studentAttendanceRouter = Router();

studentAttendanceRouter.post(
  "/",
  authMiddleware,
  allowRoles("TEACHER", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("attendance:mark"),
  validate(createStudentAttendanceSchema),
  allowOnlyClassTeacher,
  create
);

studentAttendanceRouter.get(
  "/",
  authMiddleware,
  validate({ query: listStudentAttendanceQuerySchema }),
  list
);
studentAttendanceRouter.get(
  "/:id",
  authMiddleware,
  validate({ params: studentAttendanceIdParamSchema }),
  getById
);

studentAttendanceRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("TEACHER", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("attendance:update"),
  validate({ params: studentAttendanceIdParamSchema, body: updateStudentAttendanceSchema }),
  allowOnlyClassTeacher,
  update
);

export default studentAttendanceRouter;
