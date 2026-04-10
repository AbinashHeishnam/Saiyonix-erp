import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { autoGenerate } from "@/modules/period/controller";
import { autoGeneratePeriodsSchema } from "@/modules/period/validation";

const adminPeriodRouter = Router();

adminPeriodRouter.post(
  "/admin/periods/auto-generate",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN"),
  requirePermission("period:create"),
  validate(autoGeneratePeriodsSchema),
  autoGenerate
);

export default adminPeriodRouter;
