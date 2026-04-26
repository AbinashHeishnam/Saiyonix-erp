import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { enqueueJob } from "@/core/queue/jobProducer";
import { getAdmitCardPdfForActor, getAdmitCardForActor, publishAdmitCards, setAdmitCardPublishStatus, unlockAdmitCard, listAdmitCardControls, } from "@/modules/admitCards/service";
import { admitCardQuerySchema, admitCardByStudentQuerySchema, admitCardStudentParamSchema, admitCardControlQuerySchema, examIdSchema, publishAdmitCardSchema, toggleAdmitCardSchema, } from "@/modules/admitCards/validation";
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
function parseQuery(query) {
    const parsed = admitCardQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
        throw new ApiError(400, "Invalid query");
    }
    return parsed.data;
}
function parseStudentParams(params) {
    const parsed = admitCardStudentParamSchema.safeParse(params ?? {});
    if (!parsed.success) {
        throw new ApiError(400, "Invalid student id");
    }
    return parsed.data;
}
function parseExamQuery(query) {
    const parsed = admitCardByStudentQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
        throw new ApiError(400, "Invalid query");
    }
    return parsed.data;
}
export async function generate(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const examId = parseExamId(req.params.examId);
        await enqueueJob({ type: "ADMIT_CARD_GENERATE", schoolId, examId });
        return success(res, { status: "PROCESSING" }, "Admit card generation queued");
    }
    catch (error) {
        return next(error);
    }
}
export async function unlock(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const examId = parseExamId(req.params.examId);
        const data = await unlockAdmitCard(schoolId, examId, req.body.studentId, actor, req.body.reason ?? null);
        return success(res, data, "Admit card unlocked successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function get(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const examId = parseExamId(req.params.examId);
        const query = parseQuery(req.query);
        const data = await getAdmitCardForActor(schoolId, examId, actor, query.studentId ?? null);
        return success(res, data, "Admit card fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function generatePdfs(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const examId = parseExamId(req.params.examId);
        await enqueueJob({ type: "ADMIT_CARD_PDF_GENERATE", schoolId, examId });
        return success(res, { status: "PROCESSING", count: 0 }, "Admit card PDF generation queued");
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
        const query = parseQuery(req.query);
        const data = await getAdmitCardPdfForActor(schoolId, examId, actor, query.studentId ?? null);
        return success(res, data, "Admit card PDF generated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function getByStudent(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const params = parseStudentParams(req.params);
        const query = parseExamQuery(req.query);
        const data = await getAdmitCardForActor(schoolId, query.examId, actor, params.studentId);
        return success(res, data, "Admit card fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function publish(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const parsed = publishAdmitCardSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid payload");
        }
        const data = await publishAdmitCards(schoolId, parsed.data.examId);
        return success(res, data, "Admit card published successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function togglePublish(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const parsed = toggleAdmitCardSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid payload");
        }
        const data = await setAdmitCardPublishStatus(schoolId, parsed.data.examId, parsed.data.isPublished);
        return success(res, data, "Admit card status updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function listControls(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const parsed = admitCardControlQuerySchema.safeParse(req.query ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid query");
        }
        const data = await listAdmitCardControls(schoolId, parsed.data.examId ?? null);
        return success(res, data, "Admit card controls fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
