import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMetaWithSync, parsePagination } from "@/utils/pagination";
import { adminUpdateStudentLeaveStatus as adminUpdateStudentLeaveStatusService, listStudentLeaves as listStudentLeavesService, } from "@/modules/studentLeave/service";
import { adminUpdateTeacherLeaveStatus as adminUpdateTeacherLeaveStatusService, listTeacherLeaves as listTeacherLeavesService, } from "@/modules/teacherLeave/service";
import { studentLeaveIdSchema } from "@/modules/studentLeave/validation";
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
function parseStudentLeaveId(id) {
    if (typeof id !== "string") {
        throw new ApiError(400, "Invalid id");
    }
    const parsed = studentLeaveIdSchema.safeParse(id);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid id");
    }
    return parsed.data;
}
function parseTeacherLeaveId(id) {
    if (typeof id !== "string") {
        throw new ApiError(400, "Invalid id");
    }
    const parsed = teacherLeaveIdSchema.safeParse(id);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid id");
    }
    return parsed.data;
}
export async function listStudentLeavesAdmin(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const pagination = parsePagination(req.query);
        const { items, total } = await listStudentLeavesService(schoolId, actor, pagination);
        return success(res, items, "Student leaves fetched successfully", 200, buildPaginationMetaWithSync(total, pagination));
    }
    catch (error) {
        return next(error);
    }
}
export async function listTeacherLeavesAdmin(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const pagination = parsePagination(req.query);
        const { items, total } = await listTeacherLeavesService(schoolId, actor, pagination);
        return success(res, items, "Teacher leaves fetched successfully", 200, buildPaginationMetaWithSync(total, pagination));
    }
    catch (error) {
        return next(error);
    }
}
export async function updateStudentLeaveAdmin(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const id = parseStudentLeaveId(req.params.id);
        const data = await adminUpdateStudentLeaveStatusService(schoolId, id, actor, req.body.status, req.body.remarks);
        return success(res, data, "Student leave updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function updateTeacherLeaveAdmin(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const id = parseTeacherLeaveId(req.params.id);
        const data = await adminUpdateTeacherLeaveStatusService(schoolId, id, actor, req.body.status, req.body.remarks);
        return success(res, data, "Teacher leave updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
