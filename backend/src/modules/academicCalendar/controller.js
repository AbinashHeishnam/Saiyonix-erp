import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { createAcademicCalendarEvent, createEmergencyHoliday, deleteAcademicCalendarEvent, getAcademicCalendarSummary, listAcademicCalendarEvents, updateAcademicCalendarEvent, } from "@/modules/academicCalendar/service";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
function getQueryString(value) {
    if (Array.isArray(value)) {
        return value[0];
    }
    return typeof value === "string" ? value : undefined;
}
function getParamString(value) {
    if (Array.isArray(value)) {
        return value[0];
    }
    return typeof value === "string" ? value : undefined;
}
export async function list(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const academicYearId = getQueryString(req.query.academicYearId);
        const from = getQueryString(req.query.from);
        const to = getQueryString(req.query.to);
        const eventType = getQueryString(req.query.eventType);
        if (!academicYearId) {
            throw new ApiError(400, "academicYearId is required");
        }
        const data = await listAcademicCalendarEvents({
            schoolId,
            academicYearId,
            from,
            to,
            eventType,
        });
        return success(res, data, "Academic calendar events fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function summary(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const academicYearId = getQueryString(req.query.academicYearId);
        if (!academicYearId) {
            throw new ApiError(400, "academicYearId is required");
        }
        const data = await getAcademicCalendarSummary({ schoolId, academicYearId });
        return success(res, data, "Academic calendar summary fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function create(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actorUserId = req.user?.sub;
        const data = await createAcademicCalendarEvent(schoolId, req.body, actorUserId);
        return success(res, data, "Academic calendar event created", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function update(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actorUserId = req.user?.sub;
        const eventId = getParamString(req.params.id);
        if (!eventId) {
            throw new ApiError(400, "Event id is required");
        }
        const data = await updateAcademicCalendarEvent(schoolId, eventId, req.body, actorUserId);
        return success(res, data, "Academic calendar event updated");
    }
    catch (error) {
        return next(error);
    }
}
export async function remove(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const eventId = getParamString(req.params.id);
        if (!eventId) {
            throw new ApiError(400, "Event id is required");
        }
        const data = await deleteAcademicCalendarEvent(schoolId, eventId);
        return success(res, data, "Academic calendar event removed");
    }
    catch (error) {
        return next(error);
    }
}
export async function emergencyHoliday(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actorUserId = req.user?.sub;
        const data = await createEmergencyHoliday(schoolId, req.body, actorUserId);
        return success(res, data, "Emergency holiday created", 201);
    }
    catch (error) {
        return next(error);
    }
}
