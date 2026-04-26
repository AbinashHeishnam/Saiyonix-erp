import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import { allowRoles } from "@/middleware/rbac.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import { validate } from "@/middleware/validate.middleware";
import { sendMessageSchema } from "@/modules/messages/validation";
import { contacts, getChat, send, teacherUnread, teacherUnreadSummary, unreadCount, } from "@/modules/messages/controller";
const messagesRouter = Router();
const allowMessageRead = (req, res, next) => {
    try {
        const role = req.user?.roleType ??
            req.user?.role;
        if (role === "TEACHER" || role === "STUDENT" || role === "PARENT") {
            return next();
        }
        return requirePermission("notice:read")(req, res, next);
    }
    catch (err) {
        return next(err);
    }
};
messagesRouter.post("/send", authMiddleware, allowRoles("PARENT", "STUDENT", "TEACHER"), allowMessageRead, validate(sendMessageSchema), send);
messagesRouter.get("/unread-count", authMiddleware, allowRoles("PARENT", "STUDENT", "TEACHER"), allowMessageRead, unreadCount);
messagesRouter.get("/contacts", authMiddleware, allowRoles("TEACHER"), allowMessageRead, contacts);
messagesRouter.get("/teacher-unread", authMiddleware, allowRoles("TEACHER"), allowMessageRead, teacherUnread);
messagesRouter.get("/teacher-unread-summary", authMiddleware, allowRoles("TEACHER"), allowMessageRead, teacherUnreadSummary);
messagesRouter.get("/:userId", authMiddleware, allowRoles("PARENT", "STUDENT", "TEACHER"), allowMessageRead, getChat);
export default messagesRouter;
