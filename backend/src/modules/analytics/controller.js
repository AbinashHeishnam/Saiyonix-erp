import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { getAnalyticsForActor, getSchoolAnalytics } from "./service";
export async function getStudentAnalyticsController(req, res, next) {
    try {
        const schoolId = req.schoolId;
        if (!schoolId)
            throw new ApiError(401, "Unauthorized");
        if (!req.user?.sub || !req.user?.roleType)
            throw new ApiError(401, "Unauthorized");
        const actor = { userId: req.user.sub, roleType: req.user.roleType };
        const studentId = req.params.studentId;
        const examId = req.query.examId ? String(req.query.examId) : undefined;
        const data = await getAnalyticsForActor(schoolId, studentId, examId, actor);
        return success(res, data, "Analytics fetched successfully");
    }
    catch (err) {
        next(err);
    }
}
export async function getSchoolAnalyticsController(req, res, next) {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId)
            throw new ApiError(400, "School ID is required");
        const data = await getSchoolAnalytics(schoolId);
        return success(res, data, "School analytics fetched successfully");
    }
    catch (err) {
        next(err);
    }
}
