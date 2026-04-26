import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { addTopic as addTopicService, completeTopic as completeTopicService, createSyllabus as createSyllabusService, deleteTopic as deleteTopicService, getSyllabusProgress as getSyllabusProgressService, listSyllabus as listSyllabusService, publishSyllabus as publishSyllabusService, updateTopic as updateTopicService, } from "@/modules/syllabus/service";
import { listSyllabusQuerySchema, syllabusIdSchema, syllabusTopicIdSchema, } from "@/modules/syllabus/validation";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
function parseId(id) {
    if (typeof id !== "string") {
        throw new ApiError(400, "Invalid id");
    }
    const parsed = syllabusIdSchema.safeParse(id);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid id");
    }
    return parsed.data;
}
function parseTopicId(id) {
    if (typeof id !== "string") {
        throw new ApiError(400, "Invalid id");
    }
    const parsed = syllabusTopicIdSchema.safeParse(id);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid id");
    }
    return parsed.data;
}
function parseQuery(query) {
    const parsed = listSyllabusQuerySchema.safeParse(query);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid query parameters", {
            issues: parsed.error.issues,
        });
    }
    return parsed.data;
}
function getActor(req) {
    if (!req.user?.sub || !req.user?.roleType) {
        throw new ApiError(401, "Unauthorized");
    }
    return { userId: req.user.sub, roleType: req.user.roleType };
}
export async function create(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await createSyllabusService(schoolId, req.body, actor);
        return success(res, data, "Syllabus created successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function addTopic(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const syllabusId = parseId(req.params.id);
        const data = await addTopicService(schoolId, syllabusId, req.body, actor);
        return success(res, data, "Syllabus topic created successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function updateTopic(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const topicId = parseTopicId(req.params.id);
        const data = await updateTopicService(schoolId, topicId, req.body, actor);
        return success(res, data, "Syllabus topic updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function deleteTopic(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const topicId = parseTopicId(req.params.id);
        const data = await deleteTopicService(schoolId, topicId, actor);
        return success(res, data, "Syllabus topic deleted successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function list(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const filters = parseQuery(req.query);
        const data = await listSyllabusService(schoolId, filters, actor);
        return success(res, data, "Syllabus fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function completeTopic(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const topicId = parseTopicId(req.params.id);
        const data = await completeTopicService(schoolId, topicId, actor);
        return success(res, data, "Syllabus topic completed successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function progress(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const syllabusId = parseId(req.params.id);
        const data = await getSyllabusProgressService(schoolId, syllabusId, actor);
        return success(res, data, "Syllabus progress fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function publish(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const syllabusId = parseId(req.params.id);
        const data = await publishSyllabusService(schoolId, syllabusId, actor);
        return success(res, data, "Syllabus published successfully");
    }
    catch (error) {
        return next(error);
    }
}
