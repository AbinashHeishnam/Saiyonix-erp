import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "@/utils/pagination";
import { createSubject, deleteSubject, getSubjectById, listSubjects, updateSubject, } from "@/modules/subject/service";
import { subjectIdSchema } from "@/modules/subject/validation";
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
    const parsed = subjectIdSchema.safeParse(id);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid id");
    }
    return parsed.data;
}
export async function create(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await createSubject(schoolId, req.body);
        return success(res, data, "Subject created successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function list(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const pagination = parsePagination(req.query);
        const { items, total } = await listSubjects(schoolId, pagination);
        return success(res, items, "Subjects fetched successfully", 200, buildPaginationMeta(total, pagination));
    }
    catch (error) {
        return next(error);
    }
}
export async function getById(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await getSubjectById(schoolId, id);
        return success(res, data, "Subject fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function update(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await updateSubject(schoolId, id, req.body);
        return success(res, data, "Subject updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function remove(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await deleteSubject(schoolId, id);
        return success(res, data, "Subject deleted successfully");
    }
    catch (error) {
        return next(error);
    }
}
