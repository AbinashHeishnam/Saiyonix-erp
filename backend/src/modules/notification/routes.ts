import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { allowRoles } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  getFirebaseWebConfig,
  list,
  markAllRead,
  markRead,
  registerFcm,
  registerToken,
  removeToken,
  send,
  unreadCount,
  unregisterFcm,
} from "@/modules/notification/controller";
import { sendNotificationSchema } from "@/modules/notification/send.validation";
import { listNotificationQuerySchema, notificationIdParamSchema } from "@/modules/notification/validation";
import { registerTokenSchema, removeTokenSchema } from "@/modules/notification/token.validation";
import { registerFcmSchema, unregisterFcmSchema } from "@/modules/notification/fcm.validation";
import { enqueuePushJob } from "@/modules/notification/service";
import { env } from "@/config/env";
import { notificationTokenLimiter } from "@/middleware/notificationTokenLimiter.middleware";

const notificationRouter = Router();

const allowNotificationUpdate = (req: Parameters<typeof authMiddleware>[0], res: Parameters<typeof authMiddleware>[1], next: Parameters<typeof authMiddleware>[2]) => {
  try {
    const role = (req.user as { roleType?: string; role?: string } | undefined)?.roleType ?? (req.user as { role?: string } | undefined)?.role;
    if (role === "STUDENT" || role === "PARENT" || role === "TEACHER") {
      return next();
    }
    return requirePermission("notification:update")(req, res, next);
  } catch (err) {
    return next(err);
  }
};

notificationRouter.get(
  "/",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "FINANCE_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  requirePermission("notification:read"),
  validate({ query: listNotificationQuerySchema }),
  list
);

notificationRouter.get(
  "/unread-count",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "FINANCE_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  requirePermission("notification:read"),
  unreadCount
);

notificationRouter.post(
  "/send",
  authMiddleware,
  allowRoles("ADMIN", "ACADEMIC_SUB_ADMIN"),
  requirePermission("notification:send"),
  validate(sendNotificationSchema),
  send
);

notificationRouter.post(
  "/register-token",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "FINANCE_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  allowNotificationUpdate,
  notificationTokenLimiter,
  validate(registerTokenSchema),
  registerToken
);

notificationRouter.post(
  "/remove-token",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "FINANCE_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  allowNotificationUpdate,
  notificationTokenLimiter,
  validate(removeTokenSchema),
  removeToken
);

// Public (non-auth) endpoint: service worker uses this to bootstrap Firebase app.
notificationRouter.get("/fcm/web-config", getFirebaseWebConfig);

notificationRouter.post(
  "/fcm/register",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "FINANCE_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  allowNotificationUpdate,
  notificationTokenLimiter,
  validate(registerFcmSchema),
  registerFcm
);

notificationRouter.post(
  "/fcm/unregister",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "FINANCE_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  allowNotificationUpdate,
  notificationTokenLimiter,
  validate(unregisterFcmSchema),
  unregisterFcm
);

notificationRouter.post(
  "/:id/read",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "FINANCE_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  allowNotificationUpdate,
  validate({ params: notificationIdParamSchema }),
  markRead
);

notificationRouter.post(
  "/read-all",
  authMiddleware,
  allowRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "FINANCE_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT"
  ),
  allowNotificationUpdate,
  markAllRead
);

if (env.NODE_ENV !== "production" && env.DEBUG_ROUTES_ENABLED === "true") {
  notificationRouter.post(
    "/test-queue",
    authMiddleware,
    allowRoles("ADMIN", "SUPER_ADMIN", "ACADEMIC_SUB_ADMIN", "FINANCE_SUB_ADMIN"),
    requirePermission("notification:send"),
    async (req, res, next) => {
      try {
        const authReq = req as AuthRequest;
        const userId = authReq.user?.id || authReq.user?.sub;
        const schoolId = authReq.user?.schoolId;
        if (!userId || !schoolId) {
          return res.status(400).json({
            success: false,
            message: "Missing userId or schoolId",
          });
        }
        await enqueuePushJob({
          userIds: [userId],
          message: "Test notification from BullMQ",
          title: "Test",
          body: "This is a test job",
          schoolId,
        });
        return res.json({ success: true });
      } catch (err) {
        return next(err);
      }
    }
  );
}

export default notificationRouter;
