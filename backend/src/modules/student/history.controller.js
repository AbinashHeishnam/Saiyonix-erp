import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { getStudentHistory } from "@/modules/student/history.service";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
function getActor(req) {
    return {
        userId: req.user?.sub,
        roleType: req.user?.roleType,
    };
}
function getParamString(value) {
    if (Array.isArray(value)) {
        return value[0];
    }
    return typeof value === "string" ? value : undefined;
}
export async function history(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const studentId = getParamString(req.params.id);
        if (!studentId) {
            throw new ApiError(400, "studentId is required");
        }
        const data = await getStudentHistory(schoolId, studentId, getActor(req));
        return success(res, data, "Student history fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
