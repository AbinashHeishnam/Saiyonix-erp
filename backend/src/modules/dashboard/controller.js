import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { getParentDashboard, getStudentDashboard, getTeacherDashboard, } from "@/modules/dashboard/service";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
function getUserId(req) {
    const userId = req.user?.sub;
    if (!userId) {
        throw new ApiError(401, "Unauthorized");
    }
    return userId;
}
export async function student(req, res, next) {
    try {
        const data = await getStudentDashboard({
            schoolId: getSchoolId(req),
            userId: getUserId(req),
        });
        return success(res, data, "Student dashboard fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function teacher(req, res, next) {
    try {
        const data = await getTeacherDashboard({
            schoolId: getSchoolId(req),
            userId: getUserId(req),
        });
        return success(res, data, "Teacher dashboard fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function parent(req, res, next) {
    try {
        const data = await getParentDashboard({
            schoolId: getSchoolId(req),
            userId: getUserId(req),
        });
        return success(res, data, "Parent dashboard fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
