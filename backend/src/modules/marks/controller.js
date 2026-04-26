import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { createMark as createMarkService, createMarksBulk as createMarksBulkService, updateMark as updateMarkService, } from "@/modules/marks/service";
import { markIdSchema } from "@/modules/marks/validation";
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
function parseId(id) {
    if (typeof id !== "string") {
        throw new ApiError(400, "Invalid id");
    }
    const parsed = markIdSchema.safeParse(id);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid id");
    }
    return parsed.data;
}
export async function create(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await createMarkService(schoolId, req.body, actor);
        return success(res, data, "Marks entered successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function createBulk(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const data = await createMarksBulkService(schoolId, req.body, actor);
        return success(res, data, "Marks entered successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function update(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const id = parseId(req.params.id);
        const data = await updateMarkService(schoolId, id, req.body, actor);
        return success(res, data, "Marks updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
