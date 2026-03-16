import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { parent, student, teacher } from "./controller";

const dashboardRouter = Router();

dashboardRouter.get(
  "/student",
  authMiddleware,
  allowRoles("STUDENT"),
  requirePermission("notice:read"),
  student
);

dashboardRouter.get(
  "/teacher",
  authMiddleware,
  allowRoles("TEACHER"),
  requirePermission("notice:read"),
  teacher
);

dashboardRouter.get(
  "/parent",
  authMiddleware,
  allowRoles("PARENT"),
  requirePermission("notice:read"),
  parent
);

export default dashboardRouter;
