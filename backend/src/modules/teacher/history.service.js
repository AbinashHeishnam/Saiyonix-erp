import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
export async function getTeacherHistoryByUserId(schoolId, userId) {
    const teacher = await prisma.teacher.findFirst({
        where: { schoolId, userId, deletedAt: null },
        select: { id: true, fullName: true, employeeId: true },
    });
    if (!teacher) {
        throw new ApiError(403, "Teacher account not linked");
    }
    return getTeacherHistory(schoolId, teacher.id);
}
export async function getTeacherHistory(schoolId, teacherId) {
    const teacher = await prisma.teacher.findFirst({
        where: { id: teacherId, schoolId, deletedAt: null },
        select: { id: true, fullName: true, employeeId: true },
    });
    if (!teacher) {
        throw new ApiError(404, "Teacher not found");
    }
    const assignments = await prisma.teacherSubjectClass.findMany({
        where: { teacherId },
        include: {
            academicYear: { select: { id: true, label: true, startDate: true, endDate: true } },
            classSubject: {
                include: {
                    class: { select: { id: true, className: true } },
                    subject: { select: { id: true, name: true, code: true } },
                },
            },
            section: { select: { id: true, sectionName: true } },
        },
        orderBy: [{ academicYear: { startDate: "desc" } }],
    });
    const classTeacherClasses = await prisma.class.findMany({
        where: { classTeacherId: teacherId, deletedAt: null },
        select: {
            id: true,
            className: true,
            academicYearId: true,
            academicYear: { select: { id: true, label: true, startDate: true, endDate: true } },
        },
    });
    const classTeacherSections = await prisma.section.findMany({
        where: { classTeacherId: teacherId, deletedAt: null },
        select: {
            id: true,
            sectionName: true,
            class: {
                select: {
                    id: true,
                    className: true,
                    academicYearId: true,
                    academicYear: { select: { id: true, label: true, startDate: true, endDate: true } },
                },
            },
        },
    });
    const timelineMap = new Map();
    assignments.forEach((assignment) => {
        const year = assignment.academicYear;
        if (!year)
            return;
        if (!timelineMap.has(year.id)) {
            timelineMap.set(year.id, {
                academicYear: year,
                subjects: [],
                classTeacherAssignments: [],
            });
        }
        timelineMap.get(year.id)?.subjects.push({
            classId: assignment.classSubject.class.id,
            className: assignment.classSubject.class.className,
            sectionName: assignment.section?.sectionName ?? null,
            subjectName: assignment.classSubject.subject.name,
            subjectCode: assignment.classSubject.subject.code,
        });
    });
    classTeacherClasses.forEach((cls) => {
        const year = cls.academicYear;
        if (!year)
            return;
        if (!timelineMap.has(cls.academicYearId)) {
            timelineMap.set(cls.academicYearId, {
                academicYear: year,
                subjects: [],
                classTeacherAssignments: [],
            });
        }
        timelineMap.get(cls.academicYearId)?.classTeacherAssignments.push({
            classId: cls.id,
            className: cls.className,
            sectionName: null,
        });
    });
    classTeacherSections.forEach((section) => {
        const year = section.class.academicYear;
        if (!year)
            return;
        if (!timelineMap.has(section.class.academicYearId)) {
            timelineMap.set(section.class.academicYearId, {
                academicYear: year,
                subjects: [],
                classTeacherAssignments: [],
            });
        }
        timelineMap.get(section.class.academicYearId)?.classTeacherAssignments.push({
            classId: section.class.id,
            className: section.class.className,
            sectionName: section.sectionName,
        });
    });
    const timeline = Array.from(timelineMap.values()).sort((a, b) => b.academicYear.startDate.getTime() - a.academicYear.startDate.getTime());
    return { teacher, timeline };
}
