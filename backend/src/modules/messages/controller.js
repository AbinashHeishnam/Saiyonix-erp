import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { getConversation, getTeacherContacts, getTeacherUnreadSummary, getTeacherUnreadMessages, getUnreadCount, sendMessage, } from "@/modules/messages/service";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
function getActor(req) {
    const userId = req.user?.id ?? req.user?.sub;
    return { userId, roleType: req.user?.roleType };
}
export async function send(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await sendMessage(schoolId, getActor(req), req.body);
        return success(res, data, "Message sent successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function getChat(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const userIdParam = req.params.userId;
        const userId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;
        if (!userId) {
            throw new ApiError(400, "userId is required");
        }
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Number(req.query.limit) || 20, 50);
        const skip = (page - 1) * limit;
        const data = await getConversation(schoolId, getActor(req), userId, {
            skip,
            take: limit,
        });
        return success(res, data, "Messages fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function unreadCount(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const count = await getUnreadCount(schoolId, getActor(req));
        return success(res, { count }, "Unread count fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function contacts(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await getTeacherContacts(schoolId, getActor(req));
        return success(res, data, "Contacts fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function teacherUnread(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await getTeacherUnreadMessages(schoolId, getActor(req));
        return success(res, data, "Unread messages fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function teacherUnreadSummary(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await getTeacherUnreadSummary(schoolId, getActor(req));
        return success(res, data, "Unread summary fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
