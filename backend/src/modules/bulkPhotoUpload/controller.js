import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { processBulkPhotoZip } from "@/modules/bulkPhotoUpload/service";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
export async function uploadBulkPhotos(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const file = req.file;
        if (!file) {
            throw new ApiError(400, "ZIP file is required");
        }
        const result = await processBulkPhotoZip(schoolId, file.buffer);
        return success(res, result, "Bulk photos processed successfully");
    }
    catch (error) {
        return next(error);
    }
}
