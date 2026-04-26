import { Router } from "express";
import { getStudentAnalyticsController, getSchoolAnalyticsController } from "./controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
const analyticsRouter = Router();
analyticsRouter.get("/student/:studentId", authMiddleware, allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "FINANCE_SUB_ADMIN", "TEACHER", "PARENT", "STUDENT"), requirePermission("notice:read"), getStudentAnalyticsController);
analyticsRouter.get("/school", authMiddleware, allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN"), requirePermission("notice:read"), getSchoolAnalyticsController);
export default analyticsRouter;
