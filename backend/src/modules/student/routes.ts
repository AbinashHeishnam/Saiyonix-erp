import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getById, list, remove, update, getTimetable } from "./controller";
import { createStudentSchema, updateStudentSchema } from "./validation";

const studentRouter = Router();

studentRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("student:create"),
  validate(createStudentSchema),
  create
);
studentRouter.get(
  "/:id/timetable",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "TEACHER", "PARENT", "STUDENT"),
  requirePermission("student:read"),
  getTimetable
);
studentRouter.get("/", authMiddleware, list);
studentRouter.get("/:id", authMiddleware, getById);
studentRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("student:update"),
  validate(updateStudentSchema),
  update
);
studentRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("student:delete"),
  remove
);

export default studentRouter;
