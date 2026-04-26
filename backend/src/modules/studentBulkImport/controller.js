import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildStudentImportTemplate, importStudentsFromCsv, previewStudentsFromCsv, } from "@/modules/studentBulkImport/service";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
function ensureCsv(contentType) {
    if (!contentType) {
        throw new ApiError(400, "Unsupported file type");
    }
    const normalized = contentType.toLowerCase();
    if (!normalized.includes("text/csv") && !normalized.includes("application/csv")) {
        throw new ApiError(400, "Unsupported file type");
    }
}
export async function importStudents(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const academicYearId = typeof req.query.academicYearId === "string" ? req.query.academicYearId : undefined;
        ensureCsv(req.headers["content-type"]);
        if (!Buffer.isBuffer(req.body)) {
            throw new ApiError(400, "File payload is required");
        }
        const result = await importStudentsFromCsv(schoolId, req.body, academicYearId);
        return success(res, result, "Student bulk import completed", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function previewStudents(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const academicYearId = typeof req.query.academicYearId === "string" ? req.query.academicYearId : undefined;
        ensureCsv(req.headers["content-type"]);
        if (!Buffer.isBuffer(req.body)) {
            throw new ApiError(400, "File payload is required");
        }
        const result = await previewStudentsFromCsv(schoolId, req.body, academicYearId);
        return success(res, result, "Student bulk import preview completed");
    }
    catch (error) {
        return next(error);
    }
}
export async function getStudentTemplate(_req, res, next) {
    try {
        const template = buildStudentImportTemplate();
        return success(res, { template }, "Student import template generated");
    }
    catch (error) {
        return next(error);
    }
}
