import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { toLocalDateOnly } from "@/core/utils/localDate";
export async function allowOnlyClassTeacher(req, _res, next) {
    try {
        if (req.user?.roleType !== "TEACHER") {
            return next();
        }
        const schoolId = req.schoolId;
        const userId = req.user?.sub;
        if (!schoolId || !userId) {
            throw new ApiError(401, "Unauthorized");
        }
        const teacher = await prisma.teacher.findFirst({
            where: { userId, schoolId, deletedAt: null },
            select: { id: true },
        });
        if (!teacher) {
            throw new ApiError(403, "Teacher account not linked");
        }
        let sectionId = null;
        if (typeof req.body?.sectionId === "string") {
            sectionId = req.body.sectionId;
        }
        else if (typeof req.params?.id === "string") {
            const record = await prisma.studentAttendance.findFirst({
                where: {
                    id: req.params.id,
                    section: {
                        deletedAt: null,
                        class: { schoolId, deletedAt: null },
                    },
                },
                select: { sectionId: true },
            });
            if (!record) {
                throw new ApiError(404, "Attendance record not found");
            }
            sectionId = record.sectionId;
        }
        if (!sectionId) {
            const assignedSection = await prisma.section.findFirst({
                where: {
                    classTeacherId: teacher.id,
                    deletedAt: null,
                    class: { schoolId, deletedAt: null },
                },
                select: { id: true },
            });
            if (!assignedSection) {
                throw new ApiError(400, "sectionId is required");
            }
            sectionId = assignedSection.id;
        }
        const section = await prisma.section.findFirst({
            where: {
                id: sectionId,
                deletedAt: null,
                class: { schoolId, deletedAt: null },
            },
            select: { id: true, classTeacherId: true },
        });
        if (!section) {
            throw new ApiError(404, "Section not found");
        }
        if (section.classTeacherId !== teacher.id) {
            const school = await prisma.school.findUnique({
                where: { id: schoolId },
                select: { timezone: true },
            });
            const timeZone = school?.timezone ?? "Asia/Kolkata";
            const attendanceDate = typeof req.body?.attendanceDate === "string"
                ? req.body.attendanceDate
                : typeof req.query?.attendanceDate === "string"
                    ? req.query.attendanceDate
                    : null;
            const dateOnly = toLocalDateOnly(attendanceDate, timeZone, () => new ApiError(400, "Invalid attendanceDate"));
            const substitution = await prisma.substitution.findFirst({
                where: {
                    sectionId,
                    date: dateOnly,
                    substituteTeacherId: teacher.id,
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
        return next();
    }
    catch (error) {
        return next(error);
    }
}
