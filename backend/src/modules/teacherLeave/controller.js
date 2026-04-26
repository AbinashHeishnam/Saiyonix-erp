import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "@/utils/pagination";
import { adminUpdateTeacherLeaveStatus as adminUpdateTeacherLeaveStatusService, approveTeacherLeave as approveTeacherLeaveService, applyTeacherLeave as applyTeacherLeaveService, cancelTeacherLeave as cancelTeacherLeaveService, createTeacherLeave as createTeacherLeaveService, getTeacherLeaveById as getTeacherLeaveByIdService, getTeacherLeaveTimeline as getTeacherLeaveTimelineService, listTeacherLeaves as listTeacherLeavesService, rejectTeacherLeave as rejectTeacherLeaveService, } from "@/modules/teacherLeave/service";
import { teacherLeaveIdSchema } from "@/modules/teacherLeave/validation";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
function getActor(req) {
    const userId = req.user?.sub;
    const roleType = req.user?.roleType;
    if (!userId || !roleType) {
        throw new ApiError(401, "Unauthorized");
    }
    return { userId, roleType };
}
function parseId(id) {
    if (typeof id !== "string") {
        throw new ApiError(400, "Invalid id");
    }
    const parsed = teacherLeaveIdSchema.safeParse(id);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid id");
    }
    return parsed.data;
}
export async function create(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await createTeacherLeaveService(schoolId, req.body, actor);
        return success(res, data, "Leave request created successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function apply(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const uploadedFile = req
            .uploadedFile;
        const payload = {
            ...req.body,
            attachmentUrl: uploadedFile?.fileUrl ?? req.body?.attachmentUrl,
        };
        const data = await applyTeacherLeaveService(schoolId, payload, actor);
        return success(res, data, "Leave request created successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function list(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const pagination = parsePagination(req.query);
        const { items, total } = await listTeacherLeavesService(schoolId, actor, pagination);
        return success(res, items, "Leave requests fetched successfully", 200, buildPaginationMeta(total, pagination));
    }
    catch (error) {
        return next(error);
    }
}
export async function myLeaves(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const pagination = parsePagination(req.query);
        const { items, total } = await listTeacherLeavesService(schoolId, actor, pagination);
        return success(res, items, "Leave requests fetched successfully", 200, buildPaginationMeta(total, pagination));
    }
    catch (error) {
        return next(error);
    }
}
export async function getById(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const id = parseId(req.params.id);
        const data = await getTeacherLeaveByIdService(schoolId, id, actor);
        return success(res, data, "Leave request fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function approve(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const id = parseId(req.params.id);
        const data = await approveTeacherLeaveService(schoolId, id, actor);
        return success(res, data, "Leave request approved successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function reject(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const id = parseId(req.params.id);
        const data = await rejectTeacherLeaveService(schoolId, id, actor);
        return success(res, data, "Leave request rejected successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function adminUpdate(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const id = parseId(req.params.id);
        const data = await adminUpdateTeacherLeaveStatusService(schoolId, id, actor, req.body.status, req.body.remarks);
        return success(res, data, "Leave request updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function cancel(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const id = parseId(req.params.id);
        const data = await cancelTeacherLeaveService(schoolId, id, actor);
        return success(res, data, "Leave request cancelled successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function timeline(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const id = parseId(req.params.id);
        const data = await getTeacherLeaveTimelineService(schoolId, id, actor);
        return success(res, data, "Leave timeline fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
