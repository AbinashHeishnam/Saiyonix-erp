import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getById, list, remove, update } from "./controller";
import { createSubjectSchema, updateSubjectSchema } from "./validation";

const subjectRouter = Router();

subjectRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("subject:create"),
  validate(createSubjectSchema),
  create
);
subjectRouter.get("/", authMiddleware, list);
subjectRouter.get("/:id", authMiddleware, getById);
subjectRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("subject:update"),
  validate(updateSubjectSchema),
  update
);
subjectRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("subject:delete"),
  remove
);

export default subjectRouter;
