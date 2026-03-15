import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getById, list, update } from "./controller";
import {
  createStudentAttendanceSchema,
  updateStudentAttendanceSchema,
} from "./validation";

const studentAttendanceRouter = Router();

studentAttendanceRouter.post(
  "/",
  authMiddleware,
  allowRoles("TEACHER", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("attendance:mark"),
  validate(createStudentAttendanceSchema),
  create
);

studentAttendanceRouter.get("/", authMiddleware, list);
studentAttendanceRouter.get("/:id", authMiddleware, getById);

studentAttendanceRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("TEACHER", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("attendance:update"),
  validate(updateStudentAttendanceSchema),
  update
);

export default studentAttendanceRouter;
