import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
async function ensureClassBelongsToSchool(schoolId, classId) {
    const classRecord = await prisma.class.findFirst({
        where: {
            id: classId,
            schoolId,
            deletedAt: null,
        },
        select: { id: true },
    });
    if (!classRecord) {
        throw new ApiError(400, "Class not found for this school");
    }
}
async function ensureSubjectBelongsToSchool(schoolId, subjectId) {
    const subject = await prisma.subject.findFirst({
        where: {
            id: subjectId,
            schoolId,
        },
        select: { id: true },
    });
    if (!subject) {
        throw new ApiError(400, "Subject not found for this school");
    }
}
function mapPrismaError(error) {
    const code = error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code === "P2002") {
        throw new ApiError(409, "Subject is already mapped to this class");
    }
    if (code === "P2003") {
        throw new ApiError(400, "Invalid relation reference");
    }
    throw error;
}
export async function createClassSubject(schoolId, payload) {
    await ensureClassBelongsToSchool(schoolId, payload.classId);
    await ensureSubjectBelongsToSchool(schoolId, payload.subjectId);
    try {
        return await prisma.classSubject.create({
            data: {
                classId: payload.classId,
                subjectId: payload.subjectId,
                periodsPerWeek: payload.periodsPerWeek,
            },
            include: {
                class: {
                    select: {
                        id: true,
                        className: true,
                        classOrder: true,
                    },
                },
                subject: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                    },
                },
            },
        });
    }
    catch (error) {
        mapPrismaError(error);
    }
}
export async function listClassSubjects(schoolId, pagination) {
    const where = {
        class: {
            schoolId,
            deletedAt: null,
        },
        subject: {
            schoolId,
        },
    };
    const [items, total] = await prisma.$transaction([
        prisma.classSubject.findMany({
            where,
            include: {
                class: {
                    select: {
                        id: true,
                        className: true,
                        classOrder: true,
                    },
                },
                subject: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                    },
                },
            },
            orderBy: [{ class: { classOrder: "asc" } }, { subject: { code: "asc" } }],
            ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
        }),
        prisma.classSubject.count({ where }),
    ]);
    return { items, total };
}
export async function getClassSubjectById(schoolId, id) {
    const classSubject = await prisma.classSubject.findFirst({
        where: {
            id,
            class: {
                schoolId,
                deletedAt: null,
            },
            subject: {
                schoolId,
            },
        },
        include: {
            class: {
                select: {
                    id: true,
                    className: true,
                    classOrder: true,
                },
            },
            subject: {
                select: {
                    id: true,
                    code: true,
                    name: true,
                },
            },
        },
    });
    if (!classSubject) {
        throw new ApiError(404, "Class subject mapping not found");
    }
    return classSubject;
}
export async function updateClassSubject(schoolId, id, payload) {
    await getClassSubjectById(schoolId, id);
    if (payload.classId) {
        await ensureClassBelongsToSchool(schoolId, payload.classId);
    }
    if (payload.subjectId) {
        await ensureSubjectBelongsToSchool(schoolId, payload.subjectId);
    }
    try {
        return await prisma.classSubject.update({
            where: { id },
            data: {
                ...(payload.classId !== undefined ? { classId: payload.classId } : {}),
                ...(payload.subjectId !== undefined ? { subjectId: payload.subjectId } : {}),
                ...(payload.periodsPerWeek !== undefined
                    ? { periodsPerWeek: payload.periodsPerWeek }
                    : {}),
            },
            include: {
                class: {
                    select: {
                        id: true,
                        className: true,
                        classOrder: true,
                    },
                },
                subject: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                    },
                },
            },
        });
    }
    catch (error) {
        mapPrismaError(error);
    }
}
export async function deleteClassSubject(schoolId, id) {
    await getClassSubjectById(schoolId, id);
    try {
        await prisma.classSubject.delete({
            where: { id },
        });
    }
    catch (error) {
        mapPrismaError(error);
    }
    return { id };
}
