import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "@/utils/pagination";
import { createClassSubject, deleteClassSubject, getClassSubjectById, listClassSubjects, updateClassSubject, } from "@/modules/classSubject/service";
import { classSubjectIdSchema } from "@/modules/classSubject/validation";
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
    const parsed = classSubjectIdSchema.safeParse(id);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid id");
    }
    return parsed.data;
}
export async function create(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await createClassSubject(schoolId, req.body);
        return success(res, data, "Class subject mapping created successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function list(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const pagination = parsePagination(req.query);
        const { items, total } = await listClassSubjects(schoolId, pagination);
        return success(res, items, "Class subject mappings fetched successfully", 200, buildPaginationMeta(total, pagination));
    }
    catch (error) {
        return next(error);
    }
}
export async function getById(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await getClassSubjectById(schoolId, id);
        return success(res, data, "Class subject mapping fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function update(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await updateClassSubject(schoolId, id, req.body);
        return success(res, data, "Class subject mapping updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function remove(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await deleteClassSubject(schoolId, id);
        return success(res, data, "Class subject mapping deleted successfully");
    }
    catch (error) {
        return next(error);
    }
}
