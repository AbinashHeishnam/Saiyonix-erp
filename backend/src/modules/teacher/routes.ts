import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createTeacher,
  deleteTeacher,
  getTeacher,
  listTeachers,
  updateTeacher,
  updateTeacherStatus,
  getTeacherTimetable,
} from "./controller";
import {
  createTeacherSchema,
  updateTeacherSchema,
  updateTeacherStatusSchema,
} from "./validation";

const teacherRouter = Router();

teacherRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:create"),
  validate(createTeacherSchema),
  createTeacher
);
teacherRouter.get("/", authMiddleware, listTeachers);
teacherRouter.get(
  "/:id/timetable",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER"),
  requirePermission("teacher:read"),
  getTeacherTimetable
);
teacherRouter.get("/:id", authMiddleware, getTeacher);
teacherRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:update"),
  validate(updateTeacherSchema),
  updateTeacher
);
teacherRouter.patch(
  "/:id/status",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:update"),
  validate(updateTeacherStatusSchema),
  updateTeacherStatus
);
teacherRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:delete"),
  deleteTeacher
);

export default teacherRouter;
