import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { parent, student, teacher } from "@/modules/dashboard/controller";
const dashboardRouter = Router();
const allowDashboardRead = (req, res, next) => {
    try {
        const role = req.user?.roleType ??
            req.user?.role;
        if (role === "TEACHER") {
            return next();
        }
        return requirePermission("notice:read")(req, res, next);
    }
    catch (err) {
        return next(err);
    }
};
dashboardRouter.get("/student", authMiddleware, allowRoles("STUDENT"), allowDashboardRead, student);
dashboardRouter.get("/teacher", authMiddleware, allowRoles("TEACHER"), allowDashboardRead, teacher);
dashboardRouter.get("/parent", authMiddleware, allowRoles("PARENT"), allowDashboardRead, parent);
export default dashboardRouter;
