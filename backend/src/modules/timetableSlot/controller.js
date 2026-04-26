import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "@/utils/pagination";
import { createTimetableSlot, deleteTimetableSlot, getTimetableSlotById, listTimetableSlots, updateTimetableSlot, } from "@/modules/timetableSlot/service";
import { timetableSlotIdSchema } from "@/modules/timetableSlot/validation";
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
    const parsed = timetableSlotIdSchema.safeParse(id);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid id");
    }
    return parsed.data;
}
export async function create(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await createTimetableSlot(schoolId, req.body);
        return success(res, data, "Timetable slot created successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function list(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const pagination = parsePagination(req.query);
        const { items, total } = await listTimetableSlots(schoolId, pagination);
        return success(res, items, "Timetable slots fetched successfully", 200, buildPaginationMeta(total, pagination));
    }
    catch (error) {
        return next(error);
    }
}
export async function getById(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await getTimetableSlotById(schoolId, id);
        return success(res, data, "Timetable slot fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function update(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await updateTimetableSlot(schoolId, id, req.body);
        return success(res, data, "Timetable slot updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function remove(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await deleteTimetableSlot(schoolId, id);
        return success(res, data, "Timetable slot deleted successfully");
    }
    catch (error) {
        return next(error);
    }
}
