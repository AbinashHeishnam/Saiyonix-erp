import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { getTeacherAssignedExams, getMarksEntryContext, getMarksEntryMatrix, submitMarks, submitMarksBulk, getExamResultStatus, publishExamResult, getExamResultForActor, createResultRecheckComplaint, listComplaints, getTeacherExamAnalytics, getTeacherMyClassAnalytics, } from "@/modules/examWorkflow/service";
import { examIdSchema } from "@/modules/examWorkflow/validation";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
function getActor(req) {
    if (!req.user?.sub || !req.user?.roleType) {
        throw new ApiError(401, "Unauthorized");
    }
    return { userId: req.user.sub, roleType: req.user.roleType };
}
function parseExamId(id) {
    if (typeof id !== "string") {
        throw new ApiError(400, "Invalid id");
    }
    const parsed = examIdSchema.safeParse(id);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid id");
    }
    return parsed.data;
}
export async function teacherAssignedExams(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await getTeacherAssignedExams(schoolId, actor);
        return success(res, data, "Assigned exams fetched");
    }
    catch (error) {
        return next(error);
    }
}
export async function teacherMarksEntryContext(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await getMarksEntryContext(schoolId, req.query, actor);
        return success(res, data, "Marks entry context fetched");
    }
    catch (error) {
        return next(error);
    }
}
export async function teacherMarksEntryMatrix(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await getMarksEntryMatrix(schoolId, req.query, actor);
        return success(res, data, "Marks entry matrix fetched");
    }
    catch (error) {
        return next(error);
    }
}
export async function teacherSubmitMarks(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await submitMarks(schoolId, req.body, actor);
        return success(res, data, "Marks submitted");
    }
    catch (error) {
        return next(error);
    }
}
export async function teacherSubmitMarksBulk(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await submitMarksBulk(schoolId, req.body, actor);
        return success(res, data, "Marks submitted");
    }
    catch (error) {
        return next(error);
    }
}
export async function adminExamResultStatus(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const examId = parseExamId(req.params.examId);
        const data = await getExamResultStatus(schoolId, examId, actor);
        return success(res, data, "Exam result status fetched");
    }
    catch (error) {
        return next(error);
    }
}
export async function adminPublishResult(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const examId = parseExamId(req.params.examId);
        const data = await publishExamResult(schoolId, examId, actor);
        return success(res, data, "Result publish queued");
    }
    catch (error) {
        return next(error);
    }
}
export async function getExamResultMe(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const examId = typeof req.query.examId === "string" ? req.query.examId : null;
        if (!examId) {
            throw new ApiError(400, "examId is required");
        }
        const data = await getExamResultForActor(schoolId, examId, actor);
        return success(res, data, "Result fetched");
    }
    catch (error) {
        return next(error);
    }
}
export async function studentResultRecheck(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await createResultRecheckComplaint(schoolId, req.body, actor);
        return success(res, data, "Recheck request submitted");
    }
    catch (error) {
        return next(error);
    }
}
export async function adminListComplaints(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await listComplaints(schoolId, actor, {
            category: typeof req.query.category === "string" ? req.query.category : undefined,
        });
        return success(res, data, "Complaints fetched");
    }
    catch (error) {
        return next(error);
    }
}
export async function teacherExamAnalytics(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await getTeacherExamAnalytics(schoolId, req.query, actor);
        return success(res, data, "Exam analytics fetched");
    }
    catch (error) {
        return next(error);
    }
}
export async function teacherMyClassAnalytics(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await getTeacherMyClassAnalytics(schoolId, req.query, actor);
        return success(res, data, "Class analytics fetched");
    }
    catch (error) {
        return next(error);
    }
}
