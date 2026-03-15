import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getById, list, remove, update } from "./controller";
import { createClassSchema, updateClassSchema } from "./validation";

const classRouter = Router();

classRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("class:create"),
  validate(createClassSchema),
  create
);
classRouter.get("/", authMiddleware, list);
classRouter.get("/:id", authMiddleware, getById);
classRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("class:update"),
  validate(updateClassSchema),
  update
);
classRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("class:delete"),
  remove
);

export default classRouter;
