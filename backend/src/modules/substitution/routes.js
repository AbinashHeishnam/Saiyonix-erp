import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import { allowRoles } from "@/middleware/rbac.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import { adminSubstitutions, teacherSubstitutionsToday } from "@/modules/substitution/controller";
const substitutionRouter = Router();
substitutionRouter.get("/teacher/substitutions/today", authMiddleware, allowRoles("TEACHER"), requirePermission("timetableSlot:read"), teacherSubstitutionsToday);
substitutionRouter.get("/admin/substitutions", authMiddleware, allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "SUPER_ADMIN"), requirePermission("timetableSlot:read"), adminSubstitutions);
export default substitutionRouter;
