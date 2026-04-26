import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { registerPushToken, removePushToken } from "@/modules/notification/service";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
function getUserId(req) {
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
        throw new ApiError(401, "Unauthorized");
    }
    return userId;
}
export async function register(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const userId = getUserId(req);
        const body = req.body;
        const platform = body.platform === "expo" ? "EXPO" : "FCM";
        const data = await registerPushToken({
            schoolId,
            userId,
            token: body.token,
            projectId: body.projectId,
            platform,
            deviceInfo: body.deviceInfo,
        });
        return success(res, data, "Token registered");
    }
    catch (error) {
        return next(error);
    }
}
export async function unregister(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const userId = getUserId(req);
        const body = req.body;
        const data = await removePushToken({ schoolId, userId, token: body.token });
        return success(res, data, "Token removed");
    }
    catch (error) {
        return next(error);
    }
}
