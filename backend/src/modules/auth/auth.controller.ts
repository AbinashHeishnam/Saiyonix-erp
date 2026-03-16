import type { NextFunction, Request, Response } from "express";

import {
  listUserSessions,
  loginUser,
  logoutAllSessions,
  logoutUser,
  refreshAccessToken,
  registerUser,
  unlockUserAccount,
} from "./auth.service";
import { success } from "../../utils/apiResponse";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "../../core/errors/apiError";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, roleId } = req.body as {
      email: string;
      password: string;
      roleId: string;
    };

    const user = await registerUser({ email, password, roleId });
    return success(res, user, "User registered successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as {
      email: string;
      password: string;
    };

    const result = await loginUser({ email, password });
    return success(res, result, "Login successful");
  } catch (error) {
    return next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body as {
      refreshToken: string;
    };

    const result = await refreshAccessToken(refreshToken);
    return success(res, result, "Token refreshed successfully");
  } catch (error) {
    return next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body as {
      refreshToken: string;
    };

    const result = await logoutUser(refreshToken);
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
