import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { error as errorResponse, success } from "@/utils/apiResponse";
import { buildPaginationMetaWithSync, parsePagination } from "@/utils/pagination";
import {
  getUnreadCount as getUnreadCountService,
  listNotifications as listNotificationsService,
  markAllRead as markAllReadService,
  markRead as markReadService,
  registerPushToken as registerPushTokenService,
  removePushToken as removePushTokenService,
  sendNotification as sendNotificationService,
} from "@/modules/notification/service";
import { notificationIdSchema } from "@/modules/notification/validation";
import type { RegisterTokenInput, RemoveTokenInput } from "@/modules/notification/token.validation";
import { env } from "@/config/env";
import type { RegisterFcmInput, UnregisterFcmInput } from "@/modules/notification/fcm.validation";
import { logger } from "@/utils/logger";

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

function parseId(id: unknown): string {
  if (typeof id !== "string") {
    throw new ApiError(400, "Invalid id");
  }

  const parsed = notificationIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid id");
  }

  return parsed.data;
}

function maskToken(token: string) {
  const trimmed = token.trim();
  if (trimmed.length <= 16) return "***";
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-8)}`;
}

export async function list(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const pagination = parsePagination(req.query);

    const { items, total } = await listNotificationsService(
      schoolId,
      userId,
      pagination
    );

    return success(
      res,
      items,
      "Notifications fetched successfully",
      200,
      buildPaginationMetaWithSync(total, pagination)
    );
  } catch (error) {
    return next(error);
  }
}

export async function unreadCount(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const data = await getUnreadCountService(schoolId, userId);
    return success(res, data, "Unread count fetched successfully");
  } catch (error) {
    return next(error);
  }
}

export async function markRead(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const id = parseId(req.params.id);
    const data = await markReadService(schoolId, userId, id);
    return success(res, data, "Notification marked as read");
  } catch (error) {
    return next(error);
  }
}

export async function markAllRead(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const data = await markAllReadService(schoolId, userId);
    return success(res, data, "All notifications marked as read");
  } catch (error) {
    return next(error);
  }
}

export async function send(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const idempotencyKey =
      typeof req.headers["idempotency-key"] === "string"
        ? req.headers["idempotency-key"]
        : undefined;
    const data = await sendNotificationService(
      schoolId,
      req.body,
      req.user?.sub,
      idempotencyKey
    );
    return success(res, data, "Notification sent successfully", 201);
  } catch (error) {
    return next(error);
  }
}

export async function registerToken(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const body = req.body as RegisterTokenInput;

    console.log("[PUSH][API] Incoming push token:", {
      userId,
      schoolId,
      platform: body.platform,
      token: typeof body.token === "string" ? maskToken(body.token) : null,
      hasAuthorizationHeader: typeof req.headers.authorization === "string" && req.headers.authorization.length > 0,
    });

    const platform = body.platform === "expo" ? "EXPO" : "FCM";
    const data = await registerPushTokenService({
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

export async function removeToken(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const body = req.body as RemoveTokenInput;

    const data = await removePushTokenService({ schoolId, userId, token: body.token });
    return success(res, data, "Token removed");
  } catch (error) {
    return next(error);
  }
}

export async function getFirebaseWebConfig(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const raw = env.FIREBASE_WEB_CONFIG_JSON?.trim();
    if (!raw) {
      throw new ApiError(503, "Firebase web config not configured");
    }
    let config: unknown;
    try {
      config = JSON.parse(raw);
    } catch {
      throw new ApiError(500, "Invalid FIREBASE_WEB_CONFIG_JSON");
    }

    const expectedVapidKey =
      "BDQHSl8MFwDCIXC08rP5N7FRBfDYhQWtmbjBV9mSYl5p_aCM8ZMQRG3kxlxzoO7lM5bwAvD0Jb3Ggstf4v8-g10";

    const vapidKey = env.FIREBASE_VAPID_KEY?.trim() || null;
    if (!vapidKey) {
      throw new ApiError(503, "Firebase VAPID key not configured");
    }
    if (vapidKey !== expectedVapidKey) {
      throw new ApiError(500, "Invalid FIREBASE_VAPID_KEY configured (must match Firebase Console)");
    }

    console.log("[FCM BACKEND] Sending VAPID:", vapidKey);

    return success(
      res,
      { firebaseConfig: config, vapidKey },
      "Firebase web config fetched"
    );
  } catch (error) {
    return next(error);
  }
}

export async function registerFcm(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return errorResponse(res, "Unauthorized", 401);
    }

    const rawToken = (req.body as Partial<RegisterFcmInput> | undefined)?.token;
    if (typeof rawToken !== "string" || rawToken.trim().length === 0) {
      return errorResponse(res, "token is required", 400);
    }

    const schoolId = req.schoolId ?? (req.user as { schoolId?: string }).schoolId;
    if (!schoolId) {
      return errorResponse(res, "Unauthorized", 401);
    }

    const userId = getUserId(req);
    const token = rawToken.trim();

    const deviceInfo = {
      userAgent:
        typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
    };

    if (process.env.NODE_ENV !== "production") {
      logger.info(
        `[FCM] register start user=${userId} school=${schoolId} token=${maskToken(token)} ua=${deviceInfo.userAgent ?? "n/a"}`
      );
    }

    const data = await registerPushTokenService({
      schoolId,
      userId,
      token,
      platform: "FCM",
      deviceInfo: deviceInfo as never,
    });

    logger.info(`[FCM] token registered user=${userId} token=${maskToken(token)}`);
    return success(res, data, "FCM token registered");
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      logger.error("[FCM] register failed", error);
    }
    return next(error);
  }
}

export async function unregisterFcm(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const body = req.body as UnregisterFcmInput;

    const data = await removePushTokenService({ schoolId, userId, token: body.token });
    logger.info(`[FCM] token unregistered user=${userId} token=${maskToken(body.token)}`);
    return success(res, data, "FCM token unregistered");
  } catch (error) {
    return next(error);
  }
}
