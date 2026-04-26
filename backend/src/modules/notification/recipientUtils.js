import prisma from "@/core/db/prisma";
export async function collectClassRecipients(params) {
    const students = await prisma.student.findMany({
        where: {
            schoolId: params.schoolId,
            deletedAt: null,
            enrollments: {
                some: {
                    classId: params.classId,
                    ...(params.sectionId ? { sectionId: params.sectionId } : {}),
                },
            },
        },
        select: {
            userId: true,
            parentLinks: {
                select: {
                    parent: { select: { userId: true, schoolId: true } },
                },
            },
        },
    });
    const ids = new Set();
    for (const student of students) {
        if (student.userId)
            ids.add(student.userId);
        for (const link of student.parentLinks) {
            if (link.parent.userId && link.parent.schoolId === params.schoolId) {
                ids.add(link.parent.userId);
            }
        }
    }
    return Array.from(ids);
}
export async function collectStudentRecipients(params) {
    if (!params.studentIds.length)
        return [];
    const students = await prisma.student.findMany({
        where: {
            schoolId: params.schoolId,
            deletedAt: null,
            id: { in: params.studentIds },
        },
        select: {
            userId: true,
            parentLinks: {
                select: {
                    parent: { select: { userId: true, schoolId: true } },
                },
            },
        },
    });
    const ids = new Set();
    for (const student of students) {
        if (student.userId)
            ids.add(student.userId);
        for (const link of student.parentLinks) {
            if (link.parent.userId && link.parent.schoolId === params.schoolId) {
                ids.add(link.parent.userId);
            }
        }
    }
    return Array.from(ids);
}
