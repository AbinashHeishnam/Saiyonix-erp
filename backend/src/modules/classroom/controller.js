import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { getSectionClassroom, getStudentClassroom, getSubjectClassroom, getTeacherClassroom, createAssignmentInClassroom, createAnnouncementInClassroom, createNoteInClassroom, submitAssignmentInClassroom, getChatRoomMessages, pinChatRoomMessage, } from "@/modules/classroom/service";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
function getActor(req) {
    const userId = req.user?.id ?? req.user?.sub;
    const roleType = req.user?.roleType ??
        req.user?.role;
    if (!userId || !roleType) {
        throw new ApiError(401, "Unauthorized");
    }
    return { userId, roleType };
}
function getParamString(value) {
    if (Array.isArray(value)) {
        return value[0];
    }
    return typeof value === "string" ? value : undefined;
}
function getQueryString(value) {
    if (Array.isArray(value)) {
        return value[0];
    }
    return typeof value === "string" ? value : undefined;
}
export async function teacherMe(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const teacherId = req.user?.teacherId;
        const page = Math.max(Number(getQueryString(req.query.page)) || 1, 1);
        const limit = Math.min(Number(getQueryString(req.query.limit)) || 20, 50);
        const skip = (page - 1) * limit;
        const data = await getTeacherClassroom(schoolId, actor.userId, teacherId);
        const paged = Array.isArray(data) ? data.slice(skip, skip + limit) : data;
        console.log("Teacher classroom data:", Array.isArray(data) ? data.length : 0);
        return success(res, paged, "Classroom fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function studentMe(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const studentId = getQueryString(req.query.studentId);
        const page = Math.max(Number(getQueryString(req.query.page)) || 1, 1);
        const limit = Math.min(Number(getQueryString(req.query.limit)) || 20, 50);
        const skip = (page - 1) * limit;
        const data = await getStudentClassroom(schoolId, actor.userId, actor.roleType, studentId);
        const paged = Array.isArray(data) ? data.slice(skip, skip + limit) : data;
        return success(res, paged, "Classroom fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function sectionDetail(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const sectionId = getParamString(req.params.sectionId);
        if (!sectionId) {
            throw new ApiError(400, "sectionId is required");
        }
        const data = await getSectionClassroom(schoolId, actor.userId, actor.roleType, sectionId);
        return success(res, data, "Section classroom fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function subjectDetail(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const classSubjectId = getParamString(req.params.classSubjectId);
        if (!classSubjectId) {
            throw new ApiError(400, "classSubjectId is required");
        }
        const studentId = getQueryString(req.query.studentId);
        const page = Math.max(Number(getQueryString(req.query.page)) || 1, 1);
        const limit = Math.min(Number(getQueryString(req.query.limit)) || 20, 50);
        const skip = (page - 1) * limit;
        const data = await getSubjectClassroom(schoolId, actor.userId, actor.roleType, classSubjectId, studentId, { skip, take: limit });
        return success(res, data, "Subject classroom fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function createClassroomAssignment(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await createAssignmentInClassroom(schoolId, actor, req.body);
        return success(res, data, "Assignment created successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function createClassroomNote(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await createNoteInClassroom(schoolId, actor, req.body);
        return success(res, data, "Note created successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function chatRoomMessages(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const roomId = getParamString(req.params.roomId);
        if (!roomId) {
            throw new ApiError(400, "roomId is required");
        }
        if ("limit" in req.query || "before" in req.query) {
            console.log("[Phase1] Pagination applied");
        }
        const limit = Number(getQueryString(req.query.limit));
        const before = getQueryString(req.query.before);
        const data = await getChatRoomMessages(schoolId, actor, roomId, { limit, before });
        return success(res, data, "Chat room messages fetched");
    }
    catch (error) {
        return next(error);
    }
}
export async function pinChatMessage(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const messageId = getParamString(req.params.messageId);
        if (!messageId) {
            throw new ApiError(400, "messageId is required");
        }
        const pin = req.path.includes("/unpin") ? false : true;
        const data = await pinChatRoomMessage(schoolId, actor, messageId, pin);
        return success(res, data, pin ? "Message pinned" : "Message unpinned");
    }
    catch (error) {
        return next(error);
    }
}
export async function createClassroomAnnouncement(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await createAnnouncementInClassroom(schoolId, actor, req.body);
        return success(res, data, "Announcement posted successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function submitClassroomAssignment(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await submitAssignmentInClassroom(schoolId, actor, req.body);
        return success(res, data, "Assignment submitted successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
