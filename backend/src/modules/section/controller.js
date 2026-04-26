import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "@/utils/pagination";
import { listTimetableForSection } from "@/modules/timetableSlot/service";
import { createSection, deleteSection, getSectionById, listSections, updateSection, } from "@/modules/section/service";
import { sectionIdSchema } from "@/modules/section/validation";
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
    const parsed = sectionIdSchema.safeParse(id);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid id");
    }
    return parsed.data;
}
export async function create(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await createSection(schoolId, req.body);
        return success(res, data, "Section created successfully", 201);
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
        const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
        const { items, total } = await listSections(schoolId, { academicYearId, classId }, pagination);
        return success(res, items, "Sections fetched successfully", 200, buildPaginationMeta(total, pagination));
    }
    catch (error) {
        return next(error);
    }
}
export async function getById(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await getSectionById(schoolId, id);
        return success(res, data, "Section fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function update(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await updateSection(schoolId, id, req.body);
        return success(res, data, "Section updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function remove(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await deleteSection(schoolId, id);
        return success(res, data, "Section deleted successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function getTimetable(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await listTimetableForSection(schoolId, id);
        return success(res, data, "Section timetable fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
