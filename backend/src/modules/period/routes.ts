import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getById, list, remove, update } from "./controller";
import { createPeriodSchema, updatePeriodSchema } from "./validation";

const periodRouter = Router();

periodRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("period:create"),
  validate(createPeriodSchema),
  create
);
periodRouter.get("/", authMiddleware, list);
periodRouter.get("/:id", authMiddleware, getById);
periodRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("period:update"),
  validate(updatePeriodSchema),
  update
);
periodRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("period:delete"),
  remove
);

export default periodRouter;
