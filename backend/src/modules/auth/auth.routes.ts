import { Router } from "express";

import {
  adminUnlockUser,
  completeAdminSetup,
  completeSetup,
  login,
  logout,
  logoutAll,
  refresh,
  register,
  resetPassword,
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
  verifyAdminSetupOtp,
  requestTeacherActivation,
  verifyTeacherActivation,
  completeTeacherActivationController,
  requestTeacherForgotPassword,
  verifyTeacherForgotPassword,
  completeTeacherForgotPasswordController,
  sendSetupOtp,
  sessions,
  verifySetupOtp,
  adminSetupSendOtp,
  me,
} from "@/modules/auth/auth.controller";
import { validate } from "../../middleware/validate.middleware";
import {
  loginSchema,
  logoutSchema,
  passwordResetSchema,
  passwordResetSendSchema,
  passwordResetVerifySchema,
  refreshSchema,
  registerSchema,
  setupCompleteSchema,
  setupSendOtpSchema,
  setupVerifyOtpSchema,
  adminSetupCompleteSchema,
  adminSetupVerifyOtpSchema,
  adminSetupSendOtpSchema,
  teacherIdentifierSchema,
  teacherOtpVerifySchema,
  teacherPasswordCompleteSchema,
  unlockUserSchema,
} from "@/modules/auth/auth.validation";
import { authActionLimiter, authLimiter, otpLimiter } from "../../middleware/rateLimiter.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";

const authRouter = Router();

authRouter.post("/register", validate(registerSchema), register);
authRouter.post("/login", authLimiter, validate(loginSchema), login);
authRouter.post("/refresh", authActionLimiter, validate(refreshSchema), refresh);
authRouter.post("/logout", authActionLimiter, validate(logoutSchema), logout);

authRouter.post("/password/otp/send", otpLimiter, validate(passwordResetSendSchema), sendPasswordResetOtp);
authRouter.post(
  "/password/otp/verify",
  otpLimiter,
  validate(passwordResetVerifySchema),
  verifyPasswordResetOtp
);
authRouter.post("/password/reset", authActionLimiter, validate(passwordResetSchema), resetPassword);

authRouter.post(
  "/teacher-activate/request",
  otpLimiter,
  validate(teacherIdentifierSchema),
  requestTeacherActivation
);
authRouter.post(
  "/teacher-activate/verify",
  otpLimiter,
  validate(teacherOtpVerifySchema),
  verifyTeacherActivation
);
authRouter.post(
  "/teacher-activate/complete",
  authActionLimiter,
  validate(teacherPasswordCompleteSchema),
  completeTeacherActivationController
);

authRouter.post(
  "/teacher-forgot-password/request",
  otpLimiter,
  validate(teacherIdentifierSchema),
  requestTeacherForgotPassword
);
authRouter.post(
  "/teacher-forgot-password/verify",
  otpLimiter,
  validate(teacherOtpVerifySchema),
  verifyTeacherForgotPassword
);
authRouter.post(
  "/teacher-forgot-password/complete",
  authActionLimiter,
  validate(teacherPasswordCompleteSchema),
  completeTeacherForgotPasswordController
);

authRouter.get("/sessions", authMiddleware, sessions);
authRouter.get("/me", authMiddleware, me);
authRouter.post("/logout-all", authMiddleware, logoutAll);
authRouter.post(
  "/setup/otp/send",
  authMiddleware,
  allowRoles("TEACHER"),
  validate(setupSendOtpSchema),
  sendSetupOtp
);
authRouter.post(
  "/setup/otp/verify",
  authMiddleware,
  allowRoles("TEACHER"),
  validate(setupVerifyOtpSchema),
  verifySetupOtp
);
authRouter.post(
  "/setup/complete",
  authMiddleware,
  allowRoles("TEACHER"),
  validate(setupCompleteSchema),
  completeSetup
);
authRouter.post(
  "/admin-setup/otp/send",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "FINANCE_SUB_ADMIN", "TEACHER"),
  validate(adminSetupSendOtpSchema),
  adminSetupSendOtp
);

authRouter.post(
  "/admin-setup/complete",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "FINANCE_SUB_ADMIN", "TEACHER"),
  validate(adminSetupCompleteSchema),
  completeAdminSetup
);
authRouter.post(
  "/admin-setup/verify-otp",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN", "FINANCE_SUB_ADMIN", "TEACHER"),
  validate(adminSetupVerifyOtpSchema),
  verifyAdminSetupOtp
);
authRouter.post(
  "/admin/unlock-user",
  authMiddleware,
  allowRoles("SUPER_ADMIN", "ADMIN"),
  validate(unlockUserSchema),
  adminUnlockUser
);

export default authRouter;
