import { ApiError } from "@/core/errors/apiError";
import prisma from "@/core/db/prisma";
import { success } from "@/utils/apiResponse";
import { buildPaginationMetaWithSync, parsePagination } from "@/utils/pagination";
import { toLocalDateOnly } from "@/core/utils/localDate";
import { getStudentAttendanceById, listStudentAttendance, markStudentAttendance, updateStudentAttendance, } from "@/modules/studentAttendance/service";
import { studentAttendanceIdSchema } from "@/modules/studentAttendance/validation";
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
    const parsed = studentAttendanceIdSchema.safeParse(id);
    if (!parsed.success) {
        throw new ApiError(400, "Invalid id");
    }
    return parsed.data;
}
function parseFilters(query) {
    return {
        studentId: typeof query.studentId === "string" ? query.studentId : undefined,
        sectionId: typeof query.sectionId === "string" ? query.sectionId : undefined,
        academicYearId: typeof query.academicYearId === "string" ? query.academicYearId : undefined,
        fromDate: typeof query.fromDate === "string" ? query.fromDate : undefined,
        toDate: typeof query.toDate === "string" ? query.toDate : undefined,
    };
}
export async function create(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const data = await markStudentAttendance(schoolId, req.body, getActor(req));
        return success(res, data, "Attendance marked successfully", 201);
    }
    catch (error) {
        return next(error);
    }
}
export async function list(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const actor = getActor(req);
        const pagination = parsePagination(req.query);
        const filters = parseFilters(req.query);
        if (!actor.roleType) {
            throw new ApiError(401, "Unauthorized");
        }
        if (actor.roleType === "STUDENT") {
            if (!actor.userId) {
                throw new ApiError(401, "Unauthorized");
            }
            const student = await prisma.student.findFirst({
                where: { schoolId, userId: actor.userId, deletedAt: null },
                select: { id: true },
            });
            if (!student) {
                throw new ApiError(403, "Student account not linked");
            }
            if (filters.studentId && filters.studentId !== student.id) {
                throw new ApiError(403, "Forbidden");
            }
            filters.studentId = student.id;
        }
        if (actor.roleType === "PARENT") {
            if (!actor.userId) {
                throw new ApiError(401, "Unauthorized");
            }
            const parent = await prisma.parent.findFirst({
                where: { schoolId, userId: actor.userId },
                select: { id: true },
            });
            if (!parent) {
                throw new ApiError(403, "Parent account not linked");
            }
            const links = await prisma.parentStudentLink.findMany({
                where: { parentId: parent.id },
                select: { studentId: true },
            });
            const studentIds = links.map((link) => link.studentId);
            if (studentIds.length === 0) {
                return success(res, [], "Attendance records fetched successfully", 200, buildPaginationMetaWithSync(0, pagination));
            }
            if (filters.studentId && !studentIds.includes(filters.studentId)) {
                throw new ApiError(403, "Forbidden");
            }
            if (!filters.studentId) {
                filters.studentId = studentIds[0];
            }
        }
        if (actor.roleType === "TEACHER") {
            if (!filters.sectionId) {
                throw new ApiError(400, "sectionId is required");
            }
            if (!actor.userId) {
                throw new ApiError(401, "Unauthorized");
            }
            const school = await prisma.school.findUnique({
                where: { id: schoolId },
                select: { timezone: true },
            });
            const timeZone = school?.timezone ?? "Asia/Kolkata";
            const inputDate = filters.fromDate ?? filters.toDate;
            const dateOnly = toLocalDateOnly(inputDate, timeZone);
            const teacher = await prisma.teacher.findFirst({
                where: { schoolId, userId: actor.userId, deletedAt: null },
                select: { id: true },
            });
            if (!teacher) {
                throw new ApiError(403, "Teacher account not linked");
            }
            const section = await prisma.section.findFirst({
                where: {
                    id: filters.sectionId,
                    deletedAt: null,
                    class: { schoolId, deletedAt: null },
                },
                select: { id: true, classTeacherId: true },
            });
            if (!section) {
                throw new ApiError(403, "Forbidden");
            }
            if (section.classTeacherId !== teacher.id) {
                const substitution = await prisma.substitution.findFirst({
                    where: {
                        sectionId: filters.sectionId,
                        substituteTeacherId: teacher.id,
                        date: dateOnly,
                    },
                    select: { id: true, isClassTeacherSubstitution: true, absentTeacherId: true },
                });
                console.log({
                    teacherId: teacher.id,
                    sectionClassTeacher: section.classTeacherId,
                    substitution,
                    dateOnly,
                });
                const isClassTeacher = section.classTeacherId === teacher.id;
                const isValidSubstitute = substitution &&
                    (substitution.isClassTeacherSubstitution === true ||
                        substitution.absentTeacherId === section.classTeacherId);
                if (!isClassTeacher && !isValidSubstitute) {
                    throw new ApiError(403, "Not allowed to mark attendance");
                }
            }
        }
        const { items, total } = await listStudentAttendance(schoolId, filters, pagination);
        return success(res, items, "Attendance records fetched successfully", 200, buildPaginationMetaWithSync(total, pagination));
    }
    catch (error) {
        return next(error);
    }
}
export async function getById(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await getStudentAttendanceById(schoolId, id);
        const actor = getActor(req);
        if (!actor.roleType) {
            throw new ApiError(401, "Unauthorized");
        }
        if (actor.roleType === "STUDENT") {
            if (!actor.userId) {
                throw new ApiError(401, "Unauthorized");
            }
            const student = await prisma.student.findFirst({
                where: { schoolId, userId: actor.userId, deletedAt: null },
                select: { id: true },
            });
            if (!student || data.studentId !== student.id) {
                throw new ApiError(403, "Forbidden");
            }
        }
        if (actor.roleType === "PARENT") {
            if (!actor.userId) {
                throw new ApiError(401, "Unauthorized");
            }
            const parent = await prisma.parent.findFirst({
                where: { schoolId, userId: actor.userId },
                select: { id: true },
            });
            if (!parent) {
                throw new ApiError(403, "Parent account not linked");
            }
            const link = await prisma.parentStudentLink.findFirst({
                where: { parentId: parent.id, studentId: data.studentId },
                select: { id: true },
            });
            if (!link) {
                throw new ApiError(403, "Forbidden");
            }
        }
        if (actor.roleType === "TEACHER") {
            if (!actor.userId) {
                throw new ApiError(401, "Unauthorized");
            }
            const teacher = await prisma.teacher.findFirst({
                where: { schoolId, userId: actor.userId, deletedAt: null },
                select: { id: true },
            });
            if (!teacher) {
                throw new ApiError(403, "Teacher account not linked");
            }
            const section = await prisma.section.findFirst({
                where: {
                    id: data.sectionId,
                    classTeacherId: teacher.id,
                    deletedAt: null,
                    class: { schoolId, deletedAt: null },
                },
                select: { id: true },
            });
            if (!section) {
                throw new ApiError(403, "Forbidden");
            }
        }
        return success(res, data, "Attendance record fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function update(req, res, next) {
    try {
        const schoolId = getSchoolId(req);
        const id = parseId(req.params.id);
        const data = await updateStudentAttendance(schoolId, id, req.body, getActor(req));
        return success(res, data, "Attendance record updated successfully");
    }
    catch (error) {
        return next(error);
    }
}
