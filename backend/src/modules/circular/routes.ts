import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { create, getById, list, remove, update } from "@/modules/circular/controller";
import {
  circularIdParamSchema,
  createCircularSchema,
  listCircularQuerySchema,
  updateCircularSchema,
} from "@/modules/circular/validation";

const circularRouter = Router();

circularRouter.post(
  "/",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("circular:create"),
  validate(createCircularSchema),
  create
);

circularRouter.get(
  "/",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "FINANCE_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  requirePermission("circular:read"),
  validate({ query: listCircularQuerySchema }),
  list
);

circularRouter.get(
  "/:id",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "FINANCE_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  requirePermission("circular:read"),
  validate({ params: circularIdParamSchema }),
  getById
);

circularRouter.patch(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("circular:update"),
  validate({ params: circularIdParamSchema, body: updateCircularSchema }),
  update
);

circularRouter.delete(
  "/:id",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("circular:delete"),
  validate({ params: circularIdParamSchema }),
  remove
);

export default circularRouter;
