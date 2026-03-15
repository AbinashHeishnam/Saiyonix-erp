import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  create,
  getById,
  list,
  remove,
  update,
} from "./controller";
import {
  createTeacherSubjectClassSchema,
  updateTeacherSubjectClassSchema,
} from "./validation";

const teacherSubjectClassRouter = Router();

teacherSubjectClassRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacherSubjectClass:create"),
  validate(createTeacherSubjectClassSchema),
  create
);

teacherSubjectClassRouter.get("/", authMiddleware, list);
teacherSubjectClassRouter.get("/:id", authMiddleware, getById);

teacherSubjectClassRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacherSubjectClass:update"),
  validate(updateTeacherSubjectClassSchema),
  update
);

teacherSubjectClassRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("teacherSubjectClass:delete"),
  remove
);

export default teacherSubjectClassRouter;
