import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { approve, cancel, create, getById, list, reject, timeline } from "@/modules/teacherLeave/controller";
import {
  createTeacherLeaveSchema,
  listTeacherLeaveQuerySchema,
  teacherLeaveIdParamSchema,
} from "@/modules/teacherLeave/validation";

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
  validate({ query: listTeacherLeaveQuerySchema }),
  list
);

teacherLeaveRouter.get(
  "/:id/timeline",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER"),
  requirePermission("teacherLeave:read"),
  validate({ params: teacherLeaveIdParamSchema }),
  timeline
);

teacherLeaveRouter.get(
  "/:id",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER"),
  requirePermission("teacherLeave:read"),
  validate({ params: teacherLeaveIdParamSchema }),
  getById
);

teacherLeaveRouter.patch(
  "/:id/approve",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacherLeave:update"),
  validate({ params: teacherLeaveIdParamSchema }),
  approve
);

teacherLeaveRouter.patch(
  "/:id/reject",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacherLeave:update"),
  validate({ params: teacherLeaveIdParamSchema }),
  reject
);

teacherLeaveRouter.patch(
  "/:id/cancel",
  authMiddleware,
  allowRoles("TEACHER"),
  requirePermission("teacherLeave:update"),
  validate({ params: teacherLeaveIdParamSchema }),
  cancel
);

export default teacherLeaveRouter;
