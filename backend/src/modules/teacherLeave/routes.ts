import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { approve, cancel, create, getById, list, reject, timeline } from "./controller";
import { createTeacherLeaveSchema } from "./validation";

const teacherLeaveRouter = Router();

teacherLeaveRouter.post(
  "/",
  authMiddleware,
  allowRoles("TEACHER"),
  requirePermission("teacherLeave:create"),
  validate(createTeacherLeaveSchema),
  create
);

teacherLeaveRouter.get(
  "/",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER"),
  requirePermission("teacherLeave:read"),
  list
);

teacherLeaveRouter.get(
  "/:id/timeline",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER"),
  requirePermission("teacherLeave:read"),
  timeline
);

teacherLeaveRouter.get(
  "/:id",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER"),
  requirePermission("teacherLeave:read"),
  getById
);

teacherLeaveRouter.patch(
  "/:id/approve",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacherLeave:update"),
  approve
);

teacherLeaveRouter.patch(
  "/:id/reject",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacherLeave:update"),
  reject
);

teacherLeaveRouter.patch(
  "/:id/cancel",
  authMiddleware,
  allowRoles("TEACHER"),
  requirePermission("teacherLeave:update"),
  cancel
);

export default teacherLeaveRouter;
