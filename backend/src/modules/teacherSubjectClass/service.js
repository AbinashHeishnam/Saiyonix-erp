import prisma from "@/core/db/prisma";
import { trigger } from "@/modules/notification/service";
import { collectClassRecipients } from "@/modules/notification/recipientUtils";
import { ApiError } from "@/core/errors/apiError";
function mapPrismaError(error) {
    const code = error && typeof error === "object" && "code" in error
        ? String(error.code)
        : undefined;
    if (code === "P2002") {
        throw new ApiError(409, "Teacher assignment already exists");
    }
    if (code === "P2003") {
        throw new ApiError(400, "Invalid relation reference");
    }
    throw error;
}
async function ensureTeacherBelongsToSchool(client, schoolId, teacherId) {
    const teacher = await client.teacher.findFirst({
        where: {
            id: teacherId,
            schoolId,
            deletedAt: null,
        },
        select: { id: true },
    });
    if (!teacher) {
        throw new ApiError(400, "Teacher not found for this school");
    }
}
async function ensureClassSubjectBelongsToSchool(client, schoolId, classSubjectId) {
    const classSubject = await client.classSubject.findFirst({
        where: {
            id: classSubjectId,
            class: {
                schoolId,
                deletedAt: null,
            },
            subject: {
                schoolId,
            },
        },
        select: {
            id: true,
            classId: true,
            class: { select: { academicYearId: true } },
        },
    });
    if (!classSubject) {
        throw new ApiError(400, "Class subject mapping not found for this school");
    }
    return {
        classId: classSubject.classId,
        academicYearId: classSubject.class.academicYearId,
    };
}
async function ensureSectionBelongsToSchool(client, schoolId, sectionId) {
    const section = await client.section.findFirst({
        where: {
            id: sectionId,
            deletedAt: null,
            class: {
                schoolId,
                deletedAt: null,
            },
        },
        select: { id: true, classId: true },
    });
    if (!section) {
        throw new ApiError(400, "Section not found for this school");
    }
    return section;
}
async function ensureAcademicYearBelongsToSchool(client, schoolId, academicYearId) {
    const academicYear = await client.academicYear.findFirst({
        where: {
            id: academicYearId,
            schoolId,
        },
        select: { id: true },
    });
    if (!academicYear) {
        throw new ApiError(400, "Academic year not found for this school");
    }
}
async function getTeacherSubjectClassByIdWithClient(client, schoolId, id) {
    const record = await client.teacherSubjectClass.findFirst({
        where: {
            id,
            classSubject: {
                class: {
                    schoolId,
                    deletedAt: null,
                },
                subject: {
                    schoolId,
                },
            },
            teacher: {
                schoolId,
                deletedAt: null,
            },
        },
        include: {
            teacher: true,
            classSubject: {
                include: {
                    class: true,
                    subject: true,
                },
            },
            section: true,
            academicYear: true,
        },
    });
    if (!record) {
        throw new ApiError(404, "Teacher subject assignment not found");
    }
    return record;
}
export async function createTeacherSubjectClass(schoolId, payload) {
    try {
        const created = await prisma.$transaction(async (tx) => {
            const db = tx;
            await ensureTeacherBelongsToSchool(db, schoolId, payload.teacherId);
            const classSubject = await ensureClassSubjectBelongsToSchool(db, schoolId, payload.classSubjectId);
            if (!classSubject) {
                throw new ApiError(400, "Class subject mapping not found for this school");
            }
            await ensureAcademicYearBelongsToSchool(db, schoolId, payload.academicYearId);
            if (payload.sectionId) {
                const section = await ensureSectionBelongsToSchool(db, schoolId, payload.sectionId);
                if (section.classId !== classSubject.classId) {
                    throw new ApiError(400, "Section does not belong to the selected class");
                }
            }
            if (classSubject.academicYearId !== payload.academicYearId) {
                throw new ApiError(400, "Class subject does not belong to this academic year");
            }
            return tx.teacherSubjectClass.create({
                data: {
                    teacherId: payload.teacherId,
                    classSubjectId: payload.classSubjectId,
                    sectionId: payload.sectionId ?? null,
                    academicYearId: payload.academicYearId,
                },
                include: {
                    teacher: true,
                    classSubject: {
                        include: {
                            class: true,
                            subject: true,
                        },
                    },
                    section: true,
                    academicYear: true,
                },
            });
        });
        try {
            const recipients = new Set();
            const classRecipients = await collectClassRecipients({
                schoolId,
                classId: created.classSubject.classId,
                sectionId: created.sectionId,
            });
            classRecipients.forEach((id) => recipients.add(id));
            if (created.teacher?.userId)
                recipients.add(created.teacher.userId);
            if (recipients.size) {
                await trigger("CLASS_SUBJECT_ASSIGNED", {
                    schoolId,
                    classId: created.classSubject.classId,
                    className: created.classSubject.class?.className,
                    sectionId: created.sectionId ?? undefined,
                    sectionName: created.section?.sectionName ?? undefined,
                    subjectName: created.classSubject.subject?.name,
                    userIds: Array.from(recipients),
                    metadata: {
                        teacherId: created.teacherId,
                        teacherName: created.teacher?.fullName ?? null,
                        classSubjectId: created.classSubjectId,
                    },
                });
            }
        }
        catch (error) {
            if (process.env.NODE_ENV !== "production") {
                console.error("[notify] class subject assignment failed", error);
            }
        }
        return created;
    }
    catch (error) {
        mapPrismaError(error);
    }
}
export async function getTeacherSubjectClasses(schoolId, filters, pagination) {
    const whereClause = {
        teacherId: filters.teacherId,
        sectionId: filters.sectionId,
        academicYearId: filters.academicYearId,
        classSubject: filters.classId
            ? {
                classId: filters.classId,
                class: {
                    schoolId,
                    deletedAt: null,
                },
                subject: {
                    schoolId,
                },
            }
            : {
                class: {
                    schoolId,
                    deletedAt: null,
                },
                subject: {
                    schoolId,
                },
            },
        teacher: {
            schoolId,
            deletedAt: null,
        },
    };
    const [items, total] = await prisma.$transaction([
        prisma.teacherSubjectClass.findMany({
            where: whereClause,
            include: {
                teacher: true,
                classSubject: {
                    include: {
                        class: true,
                        subject: true,
                    },
                },
                section: true,
                academicYear: true,
            },
            orderBy: { createdAt: "desc" },
            ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
        }),
        prisma.teacherSubjectClass.count({ where: whereClause }),
    ]);
    return { items, total };
}
export async function getTeacherSubjectClassById(schoolId, id) {
    return getTeacherSubjectClassByIdWithClient(prisma, schoolId, id);
}
export async function updateTeacherSubjectClass(schoolId, id, payload) {
    try {
        return await prisma.$transaction(async (tx) => {
            const db = tx;
            const existing = await getTeacherSubjectClassByIdWithClient(db, schoolId, id);
            if (payload.teacherId) {
                await ensureTeacherBelongsToSchool(db, schoolId, payload.teacherId);
            }
            const classSubject = payload.classSubjectId
                ? await ensureClassSubjectBelongsToSchool(db, schoolId, payload.classSubjectId)
                : {
                    classId: existing.classSubject.classId,
                    academicYearId: existing.classSubject.class.academicYearId,
                };
            if (payload.academicYearId) {
                await ensureAcademicYearBelongsToSchool(db, schoolId, payload.academicYearId);
            }
            if (payload.sectionId !== undefined && payload.sectionId !== null) {
                const section = await ensureSectionBelongsToSchool(db, schoolId, payload.sectionId);
                if (classSubject && section.classId !== classSubject.classId) {
                    throw new ApiError(400, "Section does not belong to the selected class");
                }
            }
            if (classSubject) {
                const academicYearId = payload.academicYearId ?? existing.academicYearId;
                if (classSubject.academicYearId !== academicYearId) {
                    throw new ApiError(400, "Class subject does not belong to this academic year");
                }
            }
            return tx.teacherSubjectClass.update({
                where: { id },
                data: {
                    ...(payload.teacherId !== undefined ? { teacherId: payload.teacherId } : {}),
                    ...(payload.classSubjectId !== undefined
                        ? { classSubjectId: payload.classSubjectId }
                        : {}),
                    ...(payload.sectionId !== undefined ? { sectionId: payload.sectionId } : {}),
                    ...(payload.academicYearId !== undefined
                        ? { academicYearId: payload.academicYearId }
                        : {}),
                },
                include: {
                    teacher: true,
                    classSubject: {
                        include: {
                            class: true,
                            subject: true,
                        },
                    },
                    section: true,
                    academicYear: true,
                },
            });
        });
    }
    catch (error) {
        mapPrismaError(error);
    }
}
export async function deleteTeacherSubjectClass(schoolId, id) {
    await getTeacherSubjectClassById(schoolId, id);
    try {
        await prisma.teacherSubjectClass.delete({
            where: { id },
        });
    }
    catch (error) {
        mapPrismaError(error);
    }
    return { id };
}
