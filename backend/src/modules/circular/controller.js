import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMetaWithSync, parsePagination } from "@/utils/pagination";
import { createCircular as createCircularService, deleteCircular as deleteCircularService, getCircularById as getCircularByIdService, listCirculars as listCircularsService, updateCircular as updateCircularService, } from "@/modules/circular/service";
import { circularIdSchema } from "@/modules/circular/validation";
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
    const parsed = circularIdSchema.safeParse(id);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid id");
    }
    return parsed.data;
}
function parseRole(value) {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== "string") {
        throw new ApiError(400, "Invalid roleType");
    }
    const allowed = [
        "SUPER_ADMIN",
        "ADMIN",
        "ACADEMIC_SUB_ADMIN",
        "FINANCE_SUB_ADMIN",
        "TEACHER",
        "PARENT",
        "STUDENT",
    ];
    if (!allowed.includes(value)) {
        throw new ApiError(400, "Invalid roleType");
    }
    return value;
}
export async function create(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await createCircularService(schoolId, req.body, req.user?.sub);
        return success(res, data, "Circular created successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function list(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const pagination = parsePagination(req.query);
        const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
        const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
        const roleType = parseRole(req.query.roleType);
        const { items, total } = await listCircularsService(schoolId, { classId, sectionId, roleType }, pagination);
        return success(res, items, "Circulars fetched successfully", 200, buildPaginationMetaWithSync(total, pagination));
    }
    catch (error) {
        return next(error);
    }
}
export async function getById(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await getCircularByIdService(schoolId, id);
        return success(res, data, "Circular fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function update(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await updateCircularService(schoolId, id, req.body, req.user?.sub);
        return success(res, data, "Circular updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function remove(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await deleteCircularService(schoolId, id, req.user?.sub);
        return success(res, data, "Circular deleted successfully");
    }
    catch (error) {
        return next(error);
    }
}
