import type { NextFunction, Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMetaWithSync, parsePagination } from "@/utils/pagination";
import {
  getUnreadCount as getUnreadCountService,
  listNotifications as listNotificationsService,
  markAllRead as markAllReadService,
  markRead as markReadService,
  sendNotification as sendNotificationService,
} from "@/modules/notification/service";
import { notificationIdSchema } from "@/modules/notification/validation";

function getSchoolId(req: AuthRequest): string {
  if (!req.schoolId) {
    throw new ApiError(401, "Unauthorized");
  }

  return req.schoolId;
}

function getUserId(req: AuthRequest): string {
  const userId = req.user?.sub;
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
