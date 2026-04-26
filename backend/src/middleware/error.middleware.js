import { env } from "@/config/env";
import { ApiError } from "@/utils/apiError";
import { error as errorResponse } from "@/utils/apiResponse";
import { logger } from "@/utils/logger";
import { MulterError } from "multer";
export function errorHandler(err, _req, res, _next) {
    if (err instanceof ApiError) {
        return errorResponse(res, err.message, err.status, err.details);
    }
    if (err instanceof MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return errorResponse(res, "File too large (max 5MB)", 413);
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return errorResponse(res, "Unexpected file field", 400);
        }
        return errorResponse(res, err.message, 400);
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    logger.error(`[API] ${message}`);
    if (err instanceof Error && err.stack) {
        logger.error(err.stack);
    }
    if (env.NODE_ENV === "development") {
        return errorResponse(res, message, 500);
    }
    return errorResponse(res, "Internal Server Error", 500);
}
