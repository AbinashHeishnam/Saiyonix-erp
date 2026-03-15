import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getByTeacherId, update } from "./controller";
import {
  createTeacherProfileSchema,
  updateTeacherProfileSchema,
} from "./validation";

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
  "/:teacherId",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:read"),
  getByTeacherId
);

teacherProfileRouter.patch(
  "/:teacherId",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacher:update"),
  validate(updateTeacherProfileSchema),
  update
);

export default teacherProfileRouter;
