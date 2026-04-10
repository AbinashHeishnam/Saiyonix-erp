import type { NextFunction, Request, Response } from "express";

import {
  listUserSessions,
  loginUser,
  logoutAllSessions,
  logoutUser,
  resetPasswordWithToken,
  sendTeacherSetupOtp,
  sendPasswordResetOtpForMobile,
  verifyPasswordResetOtpForMobile,
  verifyTeacherSetupOtp,
  completeTeacherSetup,
  completeAdminFirstLogin,
  verifyAdminFirstLoginOtp,
  requestTeacherActivationOtp,
  verifyTeacherActivationOtp,
  completeTeacherActivation,
  requestTeacherForgotPasswordOtp,
  verifyTeacherForgotPasswordOtp,
  completeTeacherForgotPassword,
  refreshAccessToken,
  registerUser,
  unlockUserAccount,
  sendAdminSetupOtp,
} from "@/modules/auth/auth.service";
import { success } from "@/utils/apiResponse";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { env } from "@/config/env";
import { basicRateLimit, rateLimitRedis } from "@/core/security/rateLimit";
import { logSecurity } from "@/core/security/logger";
import { getOrCreateCsrfToken } from "@/core/security/csrf";
import { verifyToken } from "@/utils/jwt";
import prisma from "@/core/db/prisma";
import {
  passwordResetSchema,
  passwordResetSendSchema,
  passwordResetVerifySchema,
  teacherIdentifierSchema,
  teacherOtpVerifySchema,
  teacherPasswordCompleteSchema,
} from "@/modules/auth/auth.validation";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    if (env.NODE_ENV === "production" || env.ALLOW_PUBLIC_REGISTRATION !== "true") {
      throw new ApiError(403, "Public registration is disabled");
    }

    const { email, password, roleType } = req.body as {
      email: string;
      password: string;
      roleType?: "STUDENT" | "PARENT";
    };

    const user = await registerUser({
      email,
      password,
      roleType: roleType ?? "STUDENT",
    });
    return success(res, user, "User registered successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    try {
      const key = `login:${req.ip ?? "unknown"}`;
      const isProd = process.env.NODE_ENV === "production";
      const redisCount = await rateLimitRedis(key, isProd ? 5 : 20, isProd ? 1 : 10);
      if (!redisCount && process.env.NODE_ENV !== "production") {
        basicRateLimit(key);
      }
    } catch (err) {
      logSecurity("rate_limit_login", { ip: req.ip ?? "unknown" });
      throw err;
    }
    const { email, password } = req.body as {
      email: string;
      password: string;
    };

    const result = await loginUser({ email, password });
    const sameSite: "lax" | "none" =
      process.env.NODE_ENV === "production" ? "none" : "lax";
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite,
    };
    if (result?.accessToken) {
      res.cookie("accessToken", result.accessToken, cookieOptions);
      res.cookie("access_token", result.accessToken, cookieOptions);
    }
    if (result?.refreshToken) {
      res.cookie("refreshToken", result.refreshToken, cookieOptions);
    }
    const userId = result?.userId ?? result?.user?.id;
    if (userId) {
      const csrfToken = getOrCreateCsrfToken(userId, true);
      (result as typeof result & { csrfToken?: string }).csrfToken = csrfToken;
    }
    return success(res, result, "Login successful");
  } catch (error) {
    return next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const bodyToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
    const cookieToken =
      (req as Request & { cookies?: Record<string, string> }).cookies?.refreshToken;
    const refreshToken = bodyToken ?? cookieToken;
    if (!refreshToken) {
      throw new ApiError(400, "refreshToken is required");
    }

    const result = await refreshAccessToken(refreshToken);
    const sameSite: "lax" | "none" =
      process.env.NODE_ENV === "production" ? "none" : "lax";
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite,
    };
    if (result?.accessToken) {
      res.cookie("accessToken", result.accessToken, cookieOptions);
      res.cookie("access_token", result.accessToken, cookieOptions);
    }
    if (result?.refreshToken) {
      res.cookie("refreshToken", result.refreshToken, cookieOptions);
    }
    if (result?.accessToken) {
      try {
        const payload = verifyToken(result.accessToken);
        const userId = payload?.sub;
        if (userId) {
          const csrfToken = getOrCreateCsrfToken(userId);
          (result as typeof result & { csrfToken?: string }).csrfToken = csrfToken;
        }
      } catch {
        // ignore CSRF token refresh errors
      }
    }
    return success(res, result, "Token refreshed successfully");
  } catch (error) {
    return next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const bodyToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
    const cookieToken =
      (req as Request & { cookies?: Record<string, string> }).cookies?.refreshToken;
    const refreshToken = bodyToken ?? cookieToken;
    if (!refreshToken) {
      throw new ApiError(400, "refreshToken is required");
    }

    const result = await logoutUser(refreshToken);
    const sameSite: "lax" | "none" =
      process.env.NODE_ENV === "production" ? "none" : "lax";
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite,
    };
    res.clearCookie("accessToken", cookieOptions);
    res.clearCookie("access_token", cookieOptions);
    res.clearCookie("refreshToken", cookieOptions);
    return success(res, result, "Logout successful");
  } catch (error) {
    return next(error);
  }
}

export async function sessions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.sub) {
      return next(new ApiError(401, "Unauthorized"));
    }

    const data = await listUserSessions(req.user.sub);
    return success(res, data, "Sessions fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return next(new ApiError(401, "Unauthorized"));
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        mobile: true,
        roleId: true,
        schoolId: true,
        mustChangePassword: true,
        isMobileVerified: true,
        role: { select: { id: true, roleType: true } },
      },
    });
    if (!user) {
      return next(new ApiError(401, "Unauthorized"));
    }

    const csrfToken = getOrCreateCsrfToken(userId);
    return success(
      res,
      {
        user: {
          id: user.id,
          email: user.email,
          mobile: user.mobile,
          schoolId: user.schoolId,
          roleId: user.roleId,
          mustChangePassword: user.mustChangePassword,
          phoneVerified: user.isMobileVerified,
          role: user.role,
          restricted: Boolean(req.isRestricted),
        },
        csrfToken,
      },
      "Session loaded"
    );
  } catch (error) {
    return next(error);
  }
}

export async function logoutAll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.sub) {
      return next(new ApiError(401, "Unauthorized"));
    }

    const data = await logoutAllSessions(req.user.sub);
    return success(res, data, "All sessions revoked");
  } catch (error) {
    return next(error);
  }
}

export async function adminUnlockUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, mobile } = req.body as {
      email?: string;
      mobile?: string;
    };

    const data = await unlockUserAccount({ email, mobile });
    return success(res, data, "User unlocked successfully");
  } catch (error) {
    return next(error);
  }
}

export async function adminSetupSendOtp(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user?.sub) {
      throw new ApiError(401, "Unauthorized");
    }
    const data = await sendAdminSetupOtp(req.user.sub);
    return success(res, data, "OTP sent");
  } catch (error) {
    return next(error);
  }
}

export async function sendSetupOtp(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user?.sub) {
      return next(new ApiError(401, "Unauthorized"));
    }
    const { mobile, channel } = req.body as { mobile: string; channel?: "sms" };
    if (channel && channel !== "sms") {
      throw new ApiError(422, "Voice OTP is temporarily unavailable");
    }
    const data = await sendTeacherSetupOtp(req.user.sub, mobile);
    return success(res, data, "OTP sent successfully");
  } catch (error) {
    return next(error);
  }
}

export async function verifySetupOtp(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user?.sub) {
      return next(new ApiError(401, "Unauthorized"));
    }
    const { mobile, otp } = req.body as { mobile: string; otp: string };
    const data = await verifyTeacherSetupOtp(req.user.sub, mobile, otp);
    return success(res, data, "OTP verified successfully");
  } catch (error) {
    return next(error);
  }
}

export async function completeSetup(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user?.sub) {
      return next(new ApiError(401, "Unauthorized"));
    }
    const { mobile, newPassword } = req.body as {
      mobile: string;
      newPassword: string;
    };
    const data = await completeTeacherSetup({
      userId: req.user.sub,
      mobile,
      newPassword,
    });
    return success(res, data, "Account setup completed");
  } catch (error) {
    return next(error);
  }
}

export async function completeAdminSetup(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user?.sub) {
      return next(new ApiError(401, "Unauthorized"));
    }
    const { email, newPassword } = req.body as {
      email: string;
      newPassword: string;
    };
    const data = await completeAdminFirstLogin({
      userId: req.user.sub,
      email,
      newPassword,
    });
    return success(res, data, "Account setup completed");
  } catch (error) {
    return next(error);
  }
}

export async function verifyAdminSetupOtp(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user?.sub) {
      return next(new ApiError(401, "Unauthorized"));
    }
    const { email, otp } = req.body as { email: string; otp: string };
    const data = await verifyAdminFirstLoginOtp({
      userId: req.user.sub,
      email,
      otp,
    });
    return success(res, data, "OTP verified successfully");
  } catch (error) {
    return next(error);
  }
}

export async function requestTeacherActivation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = teacherIdentifierSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid identifier");
    }
    const data = await requestTeacherActivationOtp(parsed.data.identifier);
    return success(res, data, "OTP sent successfully");
  } catch (error) {
    return next(error);
  }
}

export async function verifyTeacherActivation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = teacherOtpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid OTP");
    }
    const data = await verifyTeacherActivationOtp(parsed.data.identifier, parsed.data.otp);
    return success(res, data, "OTP verified successfully");
  } catch (error) {
    return next(error);
  }
}

export async function completeTeacherActivationController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = teacherPasswordCompleteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid payload");
    }
    const data = await completeTeacherActivation(parsed.data.resetToken, parsed.data.newPassword);
    return success(res, data, "Password setup completed");
  } catch (error) {
    return next(error);
  }
}

export async function requestTeacherForgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = teacherIdentifierSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid identifier");
    }
    const data = await requestTeacherForgotPasswordOtp(parsed.data.identifier);
    return success(res, data, "OTP sent successfully");
  } catch (error) {
    return next(error);
  }
}

export async function verifyTeacherForgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = teacherOtpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid OTP");
    }
    const data = await verifyTeacherForgotPasswordOtp(parsed.data.identifier, parsed.data.otp);
    return success(res, data, "OTP verified successfully");
  } catch (error) {
    return next(error);
  }
}

export async function completeTeacherForgotPasswordController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = teacherPasswordCompleteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid payload");
    }
    const data = await completeTeacherForgotPassword(parsed.data.resetToken, parsed.data.newPassword);
    return success(res, data, "Password reset completed");
  } catch (error) {
    return next(error);
  }
}

export async function sendPasswordResetOtp(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = passwordResetSendSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid payload");
    }
    if (parsed.data.channel && parsed.data.channel !== "sms") {
      throw new ApiError(422, "Voice OTP is temporarily unavailable");
    }
    const data = await sendPasswordResetOtpForMobile(parsed.data.mobile);
    return success(res, data, "OTP sent successfully");
  } catch (error) {
    return next(error);
  }
}

export async function verifyPasswordResetOtp(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = passwordResetVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid payload");
    }
    const data = await verifyPasswordResetOtpForMobile(parsed.data.mobile, parsed.data.otp);
    return success(res, data, "OTP verified successfully");
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = passwordResetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid payload");
    }
    const data = await resetPasswordWithToken(parsed.data.resetToken, parsed.data.newPassword);
    return success(res, data, "Password reset successfully");
  } catch (error) {
    return next(error);
  }
}
