import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { parent, student, teacher } from "@/modules/dashboard/controller";

const dashboardRouter = Router();

const allowDashboardRead = (
  req: Parameters<typeof authMiddleware>[0],
  res: Parameters<typeof authMiddleware>[1],
  next: Parameters<typeof authMiddleware>[2]
) => {
  try {
    const role =
      (req.user as { roleType?: string; role?: string } | undefined)?.roleType ??
      (req.user as { role?: string } | undefined)?.role;
    if (role === "TEACHER") {
      return next();
    }
    return requirePermission("notice:read")(req, res, next);
  } catch (err) {
    return next(err);
  }
};

dashboardRouter.get(
  "/student",
  authMiddleware,
  allowRoles("STUDENT"),
  allowDashboardRead,
  student
);

dashboardRouter.get(
  "/teacher",
  authMiddleware,
  allowRoles("TEACHER"),
  allowDashboardRead,
  teacher
);

dashboardRouter.get(
  "/parent",
  authMiddleware,
  allowRoles("PARENT"),
  allowDashboardRead,
  parent
);

export default dashboardRouter;
