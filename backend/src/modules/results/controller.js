import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { enqueueJob } from "@/core/queue/jobProducer";
import { getResultsForStudentOrParent, getResultsForAdmin, } from "@/modules/results/service";
import { examIdSchema } from "@/modules/results/validation";
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
export async function publish(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const examId = parseExamId(req.params.examId);
        await enqueueJob({
            type: "RESULTS_PUBLISH",
            schoolId,
            examId,
            actor: {
                userId: actor.userId,
                roleType: actor.roleType,
            },
        });
        return success(res, { status: "PROCESSING" }, "Results publish queued");
    }
    catch (error) {
        return next(error);
    }
}
export async function recompute(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const examId = parseExamId(req.params.examId);
        if (actor.roleType !== "SUPER_ADMIN" &&
            actor.roleType !== "ADMIN" &&
            actor.roleType !== "ACADEMIC_SUB_ADMIN") {
            throw new ApiError(403, "Forbidden");
        }
        // enqueue job for async processing
        await enqueueJob({ type: "RESULTS_RECOMPUTE", schoolId, examId });
        return success(res, { status: "PROCESSING" }, "Results recompute queued");
    }
    catch (error) {
        return next(error);
    }
}
export async function getForStudent(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const examId = parseExamId(req.params.examId);
        if (actor.roleType === "ADMIN" || actor.roleType === "ACADEMIC_SUB_ADMIN" || actor.roleType === "SUPER_ADMIN") {
            const studentId = typeof req.query.studentId === "string" ? req.query.studentId : null;
            if (!studentId) {
                throw new ApiError(400, "studentId is required for admin access");
            }
            const data = await getResultsForAdmin(schoolId, examId, studentId);
            return success(res, data, "Results fetched successfully");
        }
        const data = await getResultsForStudentOrParent(schoolId, examId, actor);
        return success(res, data, "Results fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
