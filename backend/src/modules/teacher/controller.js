import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { success } from "@/utils/apiResponse";
import { buildPaginationMeta, parsePagination } from "@/utils/pagination";
import { createTeacher as createTeacherService, deleteTeacher as deleteTeacherService, getTeacherById as getTeacherByIdService, getTeacherProfileById as getTeacherProfileByIdService, getTeacherProfileByUserId as getTeacherProfileByUserIdService, getTeacherPublicProfile as getTeacherPublicProfileService, getTeachers as getTeachersService, updateTeacher as updateTeacherService, updateTeacherProfileById as updateTeacherProfileByIdService, updateTeacherStatus as updateTeacherStatusService, getTeacherTimetable as getTeacherTimetableService, listTeacherIdCardsForAdmin, getTeacherIdCardForUser, updateTeacherIdCardDetailsAdmin, updateTeacherIdCardPhotoAdmin, } from "@/modules/teacher/service";
import { teacherIdSchema, teacherIdCardDetailsSchema } from "@/modules/teacher/validation";
function getSchoolId(req) {
    if (!req.schoolId) {
        throw new ApiError(401, "Unauthorized");
    }
    return req.schoolId;
}
function getActor(req) {
    return {
        userId: req.user?.sub,
        roleType: req.user?.roleType,
    };
}
function parseId(id) {
    if (typeof id !== "string") {
        throw new ApiError(400, "Invalid id");
    }
    const parsed = teacherIdSchema.safeParse(id);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid id");
    }
    return parsed.data;
}
function toSecureFileUrl(value) {
    if (!value)
        return null;
    if (/^https?:\/\//i.test(value))
        return value;
    if (value.startsWith("/api/v1/files/secure"))
        return value;
    return `/api/v1/files/secure?fileUrl=${encodeURIComponent(value)}`;
}
async function ensureTeacherSelfAccess(req, schoolId, teacherId) {
    const roleType = req.user?.roleType;
    if (!roleType) {
        throw new ApiError(401, "Unauthorized");
    }
    if (roleType !== "TEACHER") {
        return;
    }
    const teacher = await prisma.teacher.findFirst({
        where: {
            id: teacherId,
            schoolId,
            userId: req.user?.sub,
            deletedAt: null,
        },
        select: { id: true },
    });
    if (!teacher) {
        throw new ApiError(403, "Forbidden: cannot access this teacher timetable");
    }
}
export async function createTeacher(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await createTeacherService(schoolId, req.body);
        return success(res, data, "Teacher created successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function listTeachers(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        if ("page" in req.query || "limit" in req.query) {
            console.log("[Phase1] Pagination applied");
        }
        const pagination = parsePagination(req.query);
        const academicYearId = typeof req.query.academicYearId === "string" ? req.query.academicYearId : undefined;
        const { items, total } = await getTeachersService(schoolId, academicYearId, pagination);
        return success(res, items, "Teachers fetched successfully", 200, buildPaginationMeta(total, pagination));
    }
    catch (error) {
        return next(error);
    }
}
export async function getTeacher(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await getTeacherByIdService(schoolId, id);
        return success(res, data, "Teacher fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function updateTeacher(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await updateTeacherService(schoolId, id, req.body);
        return success(res, data, "Teacher updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function deleteTeacher(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await deleteTeacherService(schoolId, id);
        return success(res, data, "Teacher deleted successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function updateTeacherStatus(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await updateTeacherStatusService(schoolId, id, req.body);
        return success(res, data, "Teacher status updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function getTeacherTimetable(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        await ensureTeacherSelfAccess(req, schoolId, id);
        const data = await getTeacherTimetableService(schoolId, id);
        return success(res, data, "Teacher timetable fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function getTeacherProfile(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const roleType = req.user?.roleType;
        if (!roleType) {
            throw new ApiError(401, "Unauthorized");
        }
        if (roleType === "TEACHER") {
            const userId = req.user?.sub;
            if (!userId) {
                throw new ApiError(401, "Unauthorized");
            }
            const data = await getTeacherProfileByUserIdService(schoolId, userId);
            return success(res, data, "Teacher profile fetched successfully");
        }
        if (roleType === "ADMIN" || roleType === "SUPER_ADMIN") {
            const teacherId = req.query.teacherId;
            if (typeof teacherId !== "string") {
                throw new ApiError(400, "teacherId is required");
            }
            const parsed = teacherIdSchema.safeParse(teacherId);
            if (!parsed.success) {
                throw new ApiError(400, "Invalid teacherId");
            }
            const data = await getTeacherProfileByIdService(schoolId, parsed.data);
            return success(res, data, "Teacher profile fetched successfully");
        }
        throw new ApiError(403, "Forbidden");
    }
    catch (error) {
        return next(error);
    }
}
export async function updateTeacherProfile(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const roleType = req.user?.roleType;
        if (!roleType) {
            throw new ApiError(401, "Unauthorized");
        }
        if (roleType === "TEACHER") {
            const userId = req.user?.sub;
            if (!userId) {
                throw new ApiError(401, "Unauthorized");
            }
            const teacher = await prisma.teacher.findFirst({
                where: { schoolId, userId, deletedAt: null },
                select: { id: true },
            });
            if (!teacher) {
                throw new ApiError(404, "Teacher not found");
            }
            const data = await updateTeacherProfileByIdService(schoolId, teacher.id, req.body);
            return success(res, data, "Teacher profile updated successfully");
        }
        if (roleType === "ADMIN" || roleType === "SUPER_ADMIN") {
            const teacherId = req.body?.teacherId;
            if (typeof teacherId !== "string") {
                throw new ApiError(400, "teacherId is required");
            }
            const parsed = teacherIdSchema.safeParse(teacherId);
            if (!parsed.success) {
                throw new ApiError(400, "Invalid teacherId");
            }
            const data = await updateTeacherProfileByIdService(schoolId, parsed.data, req.body);
            return success(res, data, "Teacher profile updated successfully");
        }
        throw new ApiError(403, "Forbidden");
    }
    catch (error) {
        return next(error);
    }
}
export async function updateTeacherPhoto(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        if (actor.roleType !== "TEACHER") {
            throw new ApiError(403, "Forbidden");
        }
        const uploadedFile = req.uploadedFile;
        if (!uploadedFile?.fileUrl) {
            throw new ApiError(400, "Photo file is required");
        }
        const teacher = await prisma.teacher.findFirst({
            where: { schoolId, userId: actor.userId, deletedAt: null },
            select: { id: true, photoUrl: true },
        });
        if (!teacher) {
            throw new ApiError(404, "Teacher not found");
        }
        if (teacher.photoUrl) {
            throw new ApiError(403, "Photo changes are locked. Contact admin to reset.");
        }
        await prisma.teacher.update({
            where: { id: teacher.id },
            data: { photoUrl: uploadedFile.fileUrl },
        });
        return success(res, { photoUrl: toSecureFileUrl(uploadedFile.fileUrl) }, "Teacher photo updated");
    }
    catch (error) {
        return next(error);
    }
}
export async function getTeacherIdCard(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const userId = req.user?.sub;
        if (!userId) {
            throw new ApiError(401, "Unauthorized");
        }
        const data = await getTeacherIdCardForUser(schoolId, userId);
        return success(res, data, "Teacher ID card fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function listAdminTeacherIdCards(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await listTeacherIdCardsForAdmin(schoolId);
        return success(res, data, "Teacher ID cards fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function updateAdminTeacherIdCardDetails(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const parsed = teacherIdCardDetailsSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            throw new ApiError(400, "Invalid payload");
        }
        const data = await updateTeacherIdCardDetailsAdmin(schoolId, id, parsed.data);
        return success(res, data, "Teacher ID details updated");
    }
    catch (error) {
        return next(error);
    }
}
export async function updateAdminTeacherIdCardPhoto(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const uploadedFile = req.uploadedFile;
        if (!uploadedFile?.fileUrl) {
            throw new ApiError(400, "Photo file is required");
        }
        const data = await updateTeacherIdCardPhotoAdmin(schoolId, id, uploadedFile.fileUrl);
        return success(res, data, "Teacher ID photo updated");
    }
    catch (error) {
        return next(error);
    }
}
export async function getTeacherPublicProfile(req, res, next) {
    try {
        const id = parseId(req.params.id);
        const data = await getTeacherPublicProfileService(id);
        return success(res, data, "Teacher public profile fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
