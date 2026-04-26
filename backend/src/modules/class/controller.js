import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "@/utils/pagination";
import { assignClassTeacher, createClass, deleteClass, getClassById, listClasses, removeClassTeacher, updateClass, } from "@/modules/class/service";
import { classIdSchema } from "@/modules/class/validation";
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
    const parsed = classIdSchema.safeParse(id);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid id");
    }
    return parsed.data;
}
export async function create(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await createClass(schoolId, req.body);
        return success(res, data, "Class created successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function list(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const pagination = parsePagination(req.query);
        const academicYearId = typeof req.query.academicYearId === "string" ? req.query.academicYearId : undefined;
        const { items, total } = await listClasses(schoolId, academicYearId, pagination);
        return success(res, items, "Classes fetched successfully", 200, buildPaginationMeta(total, pagination));
    }
    catch (error) {
        return next(error);
    }
}
export async function getById(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await getClassById(schoolId, id);
        return success(res, data, "Class fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function update(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await updateClass(schoolId, id, req.body);
        return success(res, data, "Class updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function remove(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await deleteClass(schoolId, id);
        return success(res, data, "Class deleted successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function assignClassTeacherController(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await assignClassTeacher(schoolId, req.body);
        return success(res, data, "Class teacher assigned successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function removeClassTeacherController(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await removeClassTeacher(schoolId, req.body);
        return success(res, data, "Class teacher removed successfully");
    }
    catch (error) {
        return next(error);
    }
}
