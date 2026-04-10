import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getByTeacherId, list, update } from "@/modules/teacherProfile/controller";
import {
  createTeacherProfileSchema,
  teacherProfileTeacherIdParamSchema,
  updateTeacherProfileSchema,
} from "@/modules/teacherProfile/validation";

const teacherProfileRouter = Router();

teacherProfileRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:update"),
  validate(createTeacherProfileSchema),
  create
);

teacherProfileRouter.get(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:read"),
  list
);

teacherProfileRouter.get(
  "/:teacherId",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:read"),
  validate({ params: teacherProfileTeacherIdParamSchema }),
  getByTeacherId
);

teacherProfileRouter.patch(
  "/:teacherId",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:update"),
  validate({ params: teacherProfileTeacherIdParamSchema, body: updateTeacherProfileSchema }),
  update
);

export default teacherProfileRouter;
