import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { getClassSubjectConfig, upsertClassSubjectConfig, copyClassSubjectConfigFromPreviousYear, } from "@/modules/classSubjectConfig/service";
import { copyClassSubjectConfigSchema } from "@/modules/classSubjectConfig/validation";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
export async function upsert(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await upsertClassSubjectConfig(schoolId, req.body);
        return success(res, data, "Class subjects updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function getByClass(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const classId = req.query.classId;
        if (!classId) {
            throw new ApiError(400, "classId is required");
        }
        const data = await getClassSubjectConfig(schoolId, classId);
        return success(res, data, "Class subjects fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function copyFromPreviousYear(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const parsed = copyClassSubjectConfigSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid payload");
        }
        const data = await copyClassSubjectConfigFromPreviousYear(schoolId, parsed.data);
        return success(res, data, "Class subjects copied from previous year");
    }
    catch (error) {
        return next(error);
    }
}
