import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { approve, cancel, create, getById, list, reject, timeline } from "./controller";
import { createStudentLeaveSchema } from "./validation";

const studentLeaveRouter = Router();

studentLeaveRouter.post(
  "/",
  authMiddleware,
  allowRoles("STUDENT", "PARENT", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("studentLeave:create"),
  validate(createStudentLeaveSchema),
  create
);

studentLeaveRouter.get(
  "/",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  requirePermission("studentLeave:read"),
  list
);

studentLeaveRouter.get(
  "/:id/timeline",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  requirePermission("studentLeave:read"),
  timeline
);

studentLeaveRouter.get(
  "/:id",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  requirePermission("studentLeave:read"),
  getById
);

studentLeaveRouter.patch(
  "/:id/approve",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER"),
  requirePermission("studentLeave:update"),
  approve
);

studentLeaveRouter.patch(
  "/:id/reject",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER"),
  requirePermission("studentLeave:update"),
  reject
);

studentLeaveRouter.patch(
  "/:id/cancel",
  authMiddleware,
  allowRoles("STUDENT", "PARENT"),
  requirePermission("studentLeave:update"),
  cancel
);

export default studentLeaveRouter;
