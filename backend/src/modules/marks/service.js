import { Prisma } from "@prisma/client";
import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { bumpCacheVersion } from "@/core/cacheService";
import { safeRedisDel } from "@/core/cache/invalidate";
import { logAudit } from "@/utils/audit";
function ensureActor(actor) {
    if (!actor.userId || !actor.roleType) {
        throw new ApiError(401, "Unauthorized");
    }
    return { userId: actor.userId, roleType: actor.roleType };
}
async function resolveTeacherIdForActor(tx, schoolId, actor) {
    const { userId, roleType } = ensureActor(actor);
    if (roleType !== "TEACHER") {
        throw new ApiError(403, "Only teachers can enter marks");
    }
    const teacher = await tx.teacher.findFirst({
        where: { userId, schoolId, deletedAt: null },
        select: { id: true },
    });
    if (!teacher) {
        throw new ApiError(403, "Teacher account not linked");
    }
    return teacher.id;
}
async function ensureTeacherIsClassTeacher(tx, schoolId, params) {
    const section = await tx.section.findFirst({
        where: {
            id: params.sectionId,
            classTeacherId: params.teacherId,
            deletedAt: null,
            class: { schoolId, deletedAt: null },
        },
        select: { id: true },
    });
    if (!section) {
        throw new ApiError(403, "Only class teacher can enter marks");
    }
}
export async function createMark(schoolId, payload, actor) {
    return prisma.$transaction(async (tx) => {
        const db = tx;
        if (payload.remarks !== undefined) {
            throw new ApiError(400, "Remarks are not supported");
        }
        const teacherId = await resolveTeacherIdForActor(db, schoolId, actor);
        const examSubject = await tx.examSubject.findFirst({
            where: {
                id: payload.examSubjectId,
                exam: { schoolId },
                classSubject: { class: { schoolId, deletedAt: null } },
            },
            select: {
                id: true,
                maxMarks: true,
                classSubjectId: true,
                classSubject: { select: { classId: true } },
                exam: { select: { id: true, isLocked: true, academicYearId: true } },
            },
        });
        if (!examSubject) {
            throw new ApiError(404, "Exam subject not found");
        }
        if (examSubject.exam.isLocked) {
            throw new ApiError(400, "Marks are locked for this exam");
        }
        const studentIds = [payload.studentId];
        const [admitControl, registrations] = await Promise.all([
            tx.admitCardControl.findFirst({
                where: { examId: examSubject.exam.id },
                select: { isPublished: true },
            }),
            tx.examRegistration.findMany({
                where: { examId: examSubject.exam.id, studentId: { in: studentIds }, status: "REGISTERED" },
                select: { studentId: true },
            }),
        ]);
        if (!admitControl?.isPublished) {
            throw new ApiError(403, "Admit card not published");
        }
        const registeredSet = new Set(registrations.map((row) => row.studentId));
        if (registeredSet.size !== studentIds.length) {
            throw new ApiError(403, "Not registered for exam");
        }
        if (new Prisma.Decimal(payload.marksObtained).gt(examSubject.maxMarks)) {
            throw new ApiError(400, "Marks obtained cannot exceed max marks");
        }
        const [student, enrollment] = await Promise.all([
            tx.student.findFirst({
                where: { id: payload.studentId, schoolId, deletedAt: null },
                select: { id: true },
            }),
            tx.studentEnrollment.findFirst({
                where: {
                    studentId: payload.studentId,
                    academicYearId: examSubject.exam.academicYearId,
                    student: { schoolId, deletedAt: null },
                },
                select: { classId: true, sectionId: true },
            }),
        ]);
        if (!student) {
            throw new ApiError(404, "Student not found");
        }
        if (!enrollment) {
            throw new ApiError(404, "Student enrollment not found");
        }
        if (enrollment.classId !== examSubject.classSubject.classId) {
            throw new ApiError(403, "Student is not in the exam subject class");
        }
        await ensureTeacherIsClassTeacher(db, schoolId, {
            teacherId,
            sectionId: enrollment.sectionId,
        });
        try {
            const created = await tx.mark.create({
                data: {
                    examSubjectId: payload.examSubjectId,
                    studentId: payload.studentId,
                    sectionId: enrollment.sectionId,
                    marksObtained: new Prisma.Decimal(payload.marksObtained),
                    enteredByTeacherId: teacherId,
                },
                select: {
                    id: true,
                    studentId: true,
                    examSubjectId: true,
                    marksObtained: true,
                },
            });
            await bumpCacheVersion("report-cards", examSubject.exam.id);
            await bumpCacheVersion("ranking", examSubject.exam.id);
            await bumpCacheVersion("results", examSubject.exam.id);
            return {
                ...created,
                remarks: null,
            };
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2002") {
                    throw new ApiError(409, "Marks already entered for this student");
                }
            }
            throw new ApiError(500, "Failed to enter marks");
        }
    });
}
export async function createMarksBulk(schoolId, payload, actor) {
    const studentIds = payload.items.map((item) => item.studentId);
    return prisma.$transaction(async (tx) => {
        const db = tx;
        if (payload.items.length > 100) {
            throw new ApiError(400, "Too many items");
        }
        const teacherId = await resolveTeacherIdForActor(db, schoolId, actor);
        const examSubject = await tx.examSubject.findFirst({
            where: {
                id: payload.examSubjectId,
                exam: { schoolId },
                classSubject: { class: { schoolId, deletedAt: null } },
            },
            select: {
                id: true,
                maxMarks: true,
                classSubjectId: true,
                classSubject: { select: { classId: true } },
                exam: { select: { id: true, isLocked: true, academicYearId: true } },
            },
        });
        if (!examSubject) {
            throw new ApiError(404, "Exam subject not found");
        }
        if (examSubject.exam.isLocked) {
            throw new ApiError(400, "Marks are locked for this exam");
        }
        const [admitControl, registrations] = await Promise.all([
            tx.admitCardControl.findFirst({
                where: { examId: examSubject.exam.id },
                select: { isPublished: true },
            }),
            tx.examRegistration.findMany({
                where: { examId: examSubject.exam.id, studentId: { in: studentIds }, status: "REGISTERED" },
                select: { studentId: true },
            }),
        ]);
        if (!admitControl?.isPublished) {
            throw new ApiError(403, "Admit card not published");
        }
        const registeredSet = new Set(registrations.map((row) => row.studentId));
        if (registeredSet.size !== studentIds.length) {
            throw new ApiError(403, "Not registered for exam");
        }
        const maxDecimal = examSubject.maxMarks;
        for (const item of payload.items) {
            if (item.marksObtained > Number(maxDecimal)) {
                if (new Prisma.Decimal(item.marksObtained).gt(maxDecimal)) {
                    throw new ApiError(400, "Marks obtained cannot exceed max marks");
                }
            }
        }
        const [students, enrollments, existingMarks] = await Promise.all([
            tx.student.findMany({
                where: { id: { in: studentIds }, schoolId, deletedAt: null },
                select: { id: true },
            }),
            tx.studentEnrollment.findMany({
                where: {
                    studentId: { in: studentIds },
                    academicYearId: examSubject.exam.academicYearId,
                    student: { schoolId, deletedAt: null },
                },
                select: { studentId: true, classId: true, sectionId: true, createdAt: true },
            }),
            tx.mark.findMany({
                where: {
                    examSubjectId: payload.examSubjectId,
                    OR: studentIds.map((studentId) => ({ studentId })),
                },
                select: { studentId: true, sectionId: true },
            }),
        ]);
        if (students.length !== studentIds.length) {
            throw new ApiError(404, "Student not found");
        }
        if (existingMarks.length > 0) {
            const enrollmentByStudent = new Map(enrollments.map((enrollment) => [enrollment.studentId, enrollment.sectionId]));
            const hasConflict = existingMarks.some((mark) => {
                const sectionId = enrollmentByStudent.get(mark.studentId);
                return sectionId && mark.sectionId === sectionId;
            });
            if (hasConflict) {
                throw new ApiError(409, "Marks already entered for one or more students");
            }
        }
        const latestEnrollmentByStudent = new Map();
        for (const enrollment of enrollments) {
            if (!latestEnrollmentByStudent.has(enrollment.studentId)) {
                latestEnrollmentByStudent.set(enrollment.studentId, {
                    classId: enrollment.classId,
                    sectionId: enrollment.sectionId,
                    createdAt: enrollment.createdAt,
                });
            }
        }
        for (const studentId of studentIds) {
            const enrollment = latestEnrollmentByStudent.get(studentId);
            if (!enrollment) {
                throw new ApiError(404, "Student enrollment not found");
            }
            if (enrollment.classId !== examSubject.classSubject.classId) {
                throw new ApiError(403, "Student is not in the exam subject class");
            }
            await ensureTeacherIsClassTeacher(db, schoolId, {
                teacherId,
                sectionId: enrollment.sectionId,
            });
        }
        const sectionByStudent = new Map(enrollments.map((enrollment) => [enrollment.studentId, enrollment.sectionId]));
        const data = payload.items.map((item) => ({
            examSubjectId: payload.examSubjectId,
            studentId: item.studentId,
            sectionId: sectionByStudent.get(item.studentId) ?? null,
            marksObtained: new Prisma.Decimal(item.marksObtained),
            enteredByTeacherId: teacherId,
        }));
        const result = await tx.mark.createMany({ data, skipDuplicates: true });
        if (result.count !== data.length) {
            throw new ApiError(409, "Some marks already exist");
        }
        await bumpCacheVersion("report-cards", examSubject.exam.id);
        await bumpCacheVersion("ranking", examSubject.exam.id);
        await bumpCacheVersion("results", examSubject.exam.id);
        return { insertedCount: data.length };
    });
}
export async function updateMark(schoolId, markId, payload, actor) {
    return prisma.$transaction(async (tx) => {
        const db = tx;
        const teacherId = await resolveTeacherIdForActor(db, schoolId, actor);
        const mark = await tx.mark.findFirst({
            where: { id: markId },
            select: {
                id: true,
                studentId: true,
                examSubjectId: true,
                marksObtained: true,
                enteredAt: true,
                lastEditedAt: true,
                enteredByTeacherId: true,
                examSubject: {
                    select: {
                        maxMarks: true,
                        classSubjectId: true,
                        classSubject: { select: { classId: true } },
                        exam: {
                            select: {
                                id: true,
                                schoolId: true,
                                isLocked: true,
                                academicYearId: true,
                            },
                        },
                    },
                },
            },
        });
        if (!mark) {
            throw new ApiError(404, "Mark not found");
        }
        if (mark.examSubject.exam.schoolId !== schoolId) {
            throw new ApiError(404, "Mark not found");
        }
        if (mark.examSubject.exam.isLocked) {
            throw new ApiError(400, "Marks are locked for this exam");
        }
        const now = new Date();
        const deadline = new Date(mark.enteredAt.getTime() + 24 * 60 * 60 * 1000);
        if (now > deadline) {
            throw new ApiError(403, "Edit window expired");
        }
        const nextMarks = new Prisma.Decimal(payload.marksObtained);
        if (nextMarks.gt(mark.examSubject.maxMarks)) {
            throw new ApiError(400, "Marks obtained cannot exceed max marks");
        }
        const enrollment = await tx.studentEnrollment.findFirst({
            where: {
                studentId: mark.studentId,
                academicYearId: mark.examSubject.exam.academicYearId,
                student: { schoolId, deletedAt: null },
            },
            select: { sectionId: true },
        });
        if (!enrollment) {
            throw new ApiError(404, "Student enrollment not found");
        }
        await ensureTeacherIsClassTeacher(db, schoolId, {
            teacherId,
            sectionId: enrollment.sectionId,
        });
        if (nextMarks.equals(mark.marksObtained)) {
            return {
                id: mark.id,
                studentId: mark.studentId,
                examSubjectId: mark.examSubjectId,
                marksObtained: mark.marksObtained,
                lastEditedAt: mark.lastEditedAt,
            };
        }
        const updated = await tx.mark.update({
            where: { id: markId },
            data: {
                marksObtained: nextMarks,
                lastEditedAt: now,
            },
            select: {
                id: true,
                studentId: true,
                examSubjectId: true,
                marksObtained: true,
                lastEditedAt: true,
            },
        });
        await tx.markEditLog.create({
            data: {
                markId: mark.id,
                oldMarks: mark.marksObtained,
                newMarks: nextMarks,
                reason: "MARK_UPDATE",
                editedById: teacherId,
                editedAt: now,
            },
        });
        await logAudit({
            userId: actor.userId,
            action: "MARK_EDITED",
            entity: "Mark",
            entityId: mark.id,
            metadata: {
                markId: mark.id,
                examSubjectId: mark.examSubjectId,
                studentId: mark.studentId,
                oldMarks: mark.marksObtained,
                newMarks: nextMarks,
            },
        });
        await bumpCacheVersion("report-cards", mark.examSubject.exam.id);
        await bumpCacheVersion("ranking", mark.examSubject.exam.id);
        await bumpCacheVersion("results", mark.examSubject.exam.id);
        try {
            await safeRedisDel([
                `marks:student:${mark.studentId}`,
                `results:student:${mark.studentId}`,
                `dashboard:student:${mark.studentId}`,
            ]);
        }
        catch {
            // ignore cache failures
        }
        return updated;
    });
}
