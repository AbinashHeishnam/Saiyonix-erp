import { ApiError } from "@/core/errors/apiError";
import { Queue } from "bullmq";
import { success } from "@/utils/apiResponse";
import { enqueueJob } from "@/core/queue/jobProducer";
import { getJobQueue } from "@/core/queue/queue";
import { generateReportCardPdf, getReportCardForActor, getReportCardForAdmin, getReportCardPdfStatus, } from "@/modules/reportCards/service";
import { examIdSchema } from "@/modules/reportCards/validation";
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
export async function get(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const examId = parseExamId(req.params.examId);
        if (actor.roleType === "ADMIN" || actor.roleType === "ACADEMIC_SUB_ADMIN" || actor.roleType === "SUPER_ADMIN") {
            const studentId = typeof req.query.studentId === "string" ? req.query.studentId : null;
            if (!studentId) {
                throw new ApiError(400, "studentId is required for admin access");
            }
            const data = await getReportCardForAdmin(schoolId, examId, studentId, actor);
            return success(res, data, "Report card fetched successfully");
        }
        const data = await getReportCardForActor(schoolId, examId, actor);
        return success(res, data, "Report card fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function getPdf(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const examId = parseExamId(req.params.examId);
        const forceValue = typeof req.query.force === "string"
            ? req.query.force
            : Array.isArray(req.query.force)
                ? req.query.force[0]
                : undefined;
        const force = forceValue === "1" || forceValue === "true";
        let studentId = null;
        if (actor.roleType === "ADMIN" || actor.roleType === "ACADEMIC_SUB_ADMIN" || actor.roleType === "SUPER_ADMIN") {
            studentId = typeof req.query.studentId === "string" ? req.query.studentId : null;
            if (!studentId) {
                throw new ApiError(400, "studentId is required for admin access");
            }
        }
        const resolvedStudentId = studentId ??
            (await getReportCardForActor(schoolId, examId, actor)).studentId;
        if (force) {
            const data = await generateReportCardPdf(schoolId, examId, resolvedStudentId, { force: true });
            return success(res, data, "Report card PDF ready");
        }
        const status = await getReportCardPdfStatus(schoolId, examId, resolvedStudentId);
        if (status.pdfUrl) {
            return success(res, status, "Report card PDF ready");
        }
        const queue = await getJobQueue();
        if (!(queue instanceof Queue)) {
            const data = await generateReportCardPdf(schoolId, examId, resolvedStudentId);
            return success(res, data, "Report card PDF ready");
        }
        await enqueueJob({
            type: "REPORT_CARD_PDF_GENERATE",
            schoolId,
            examId,
            studentId: resolvedStudentId,
        });
        return success(res, { ...status, status: "PROCESSING" }, "Report card PDF queued");
    }
    catch (error) {
        return next(error);
    }
}
