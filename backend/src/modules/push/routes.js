import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import { allowRoles } from "@/middleware/rbac.middleware";
import { validate } from "@/middleware/validate.middleware";
import { notificationTokenLimiter } from "@/middleware/notificationTokenLimiter.middleware";
import { registerTokenSchema, removeTokenSchema } from "@/modules/notification/token.validation";
import { register, unregister } from "@/modules/push/controller";
const router = Router();
// Alias routes for Expo mobile apps.
router.post("/register", authMiddleware, allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "FINANCE_SUB_ADMIN", "TEACHER", "PARENT", "STUDENT"), notificationTokenLimiter, validate(registerTokenSchema), register);
router.post("/unregister", authMiddleware, allowRoles("SUPER_ADMIN", "ADMIN", "ACADEMIC_SUB_ADMIN", "FINANCE_SUB_ADMIN", "TEACHER", "PARENT", "STUDENT"), notificationTokenLimiter, validate(removeTokenSchema), unregister);
export default router;
