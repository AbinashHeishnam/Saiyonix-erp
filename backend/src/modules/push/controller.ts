import type { NextFunction, Response } from "express";

import type { AuthRequest } from "@/middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { registerPushToken, removePushToken } from "@/modules/notification/service";
import type { RegisterTokenInput, RemoveTokenInput } from "@/modules/notification/token.validation";

function getSchoolId(req: AuthRequest): string {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  return req.schoolId;
}

function getUserId(req: AuthRequest): string {
  const userId = req.user?.sub ?? req.user?.id;
  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }
  return userId;
}

export async function register(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const body = req.body as RegisterTokenInput;

    const platform = body.platform === "expo" ? "EXPO" : "FCM";
    const data = await registerPushToken({
      schoolId,
      userId,
      token: body.token,
      platform,
      deviceInfo: body.deviceInfo as never,
    });

    return success(res, data, "Token registered");
  } catch (error) {
    return next(error);
  }
}

export async function unregister(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const body = req.body as RemoveTokenInput;

    const data = await removePushToken({ schoolId, userId, token: body.token });
    return success(res, data, "Token removed");
  } catch (error) {
    return next(error);
  }
}

