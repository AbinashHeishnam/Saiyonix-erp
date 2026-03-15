import { Router } from "express";

import {
  adminUnlockUser,
  login,
  logout,
  logoutAll,
  refresh,
  register,
  sessions,
} from "./auth.controller";
import { validate } from "../../middleware/validate.middleware";
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  unlockUserSchema,
} from "./auth.validation";
import { authLimiter } from "../../middleware/rateLimiter.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";

const authRouter = Router();

authRouter.post("/register", validate(registerSchema), register);
authRouter.post("/login", authLimiter, validate(loginSchema), login);
authRouter.post("/refresh", validate(refreshSchema), refresh);
authRouter.post("/logout", validate(logoutSchema), logout);

authRouter.get("/sessions", authMiddleware, sessions);
authRouter.post("/logout-all", authMiddleware, logoutAll);
authRouter.post(
  "/admin/unlock-user",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN"),
  validate(unlockUserSchema),
  adminUnlockUser
);

export default authRouter;
