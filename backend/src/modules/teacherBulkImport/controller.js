import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildTeacherImportTemplate, importTeachersFromCsv, previewTeachersFromCsv, } from "@/modules/teacherBulkImport/service";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
export async function importTeacherBulk(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        if (!Buffer.isBuffer(req.body)) {
            throw new ApiError(400, "CSV file is required");
        }
        const data = await importTeachersFromCsv(schoolId, req.body);
        return success(res, data, "Teacher import completed");
    }
    catch (error) {
        return next(error);
    }
}
export async function previewTeacherBulk(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        if (!Buffer.isBuffer(req.body)) {
            throw new ApiError(400, "CSV file is required");
        }
        const data = await previewTeachersFromCsv(schoolId, req.body);
        return success(res, data, "Teacher import preview completed");
    }
    catch (error) {
        return next(error);
    }
}
export async function getTeacherTemplate(_req, res, next) {
    try {
        const template = buildTeacherImportTemplate();
        return success(res, { template }, "Teacher import template generated");
    }
    catch (error) {
        return next(error);
    }
}
export async function getFailedTeacherCsv(req, res, next) {
    try {
        const errors = (req.body?.errors ?? []);
        if (!Array.isArray(errors) || errors.length === 0) {
            throw new ApiError(400, "errors array is required");
        }
        const headers = [
            "firstName",
            "lastName",
            "email",
            "phone",
            "gender",
            "qualification",
            "experienceYears",
            "address",
            "error",
        ];
        const rows = errors.map((item) => {
            const rowData = item.data ?? {};
            const values = headers.slice(0, -1).map((key) => String(rowData[key] ?? "").replace(/"/g, "\"\""));
            values.push(String(item.reason ?? "").replace(/"/g, "\"\""));
            return values.map((value) => `"${value}"`).join(",");
        });
        const csv = [headers.join(","), ...rows].join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", "attachment; filename=failed_teachers.csv");
        return res.status(200).send(csv);
    }
    catch (error) {
        return next(error);
    }
}
