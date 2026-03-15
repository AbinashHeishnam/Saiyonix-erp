import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getById, list, remove, update } from "./controller";
import { createClassSubjectSchema, updateClassSubjectSchema } from "./validation";

const classSubjectRouter = Router();

classSubjectRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("classSubject:create"),
  validate(createClassSubjectSchema),
  create
);
classSubjectRouter.get("/", authMiddleware, list);
classSubjectRouter.get("/:id", authMiddleware, getById);
classSubjectRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("classSubject:update"),
  validate(updateClassSubjectSchema),
  update
);
classSubjectRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("classSubject:delete"),
  remove
);

export default classSubjectRouter;
