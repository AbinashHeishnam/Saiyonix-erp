import { Prisma } from "@prisma/client";
import prisma from "@/core/db/prisma";
import { trigger } from "@/modules/notification/service";
import { collectClassRecipients } from "@/modules/notification/recipientUtils";
import { ApiError } from "@/core/errors/apiError";
async function ensureAcademicYearBelongsToSchool(schoolId, academicYearId) {
    const academicYear = await prisma.academicYear.findFirst({
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
async function getActiveAcademicYearId(schoolId) {
    const academicYear = await prisma.academicYear.findFirst({
        where: { schoolId, isActive: true },
        select: { id: true },
    });
    if (!academicYear) {
        throw new ApiError(400, "Active academic year not found");
    }
    return academicYear.id;
}
function mapPrismaError(error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
            throw new ApiError(409, "Class already exists for this academic year");
        }
        if (error.code === "P2003") {
            throw new ApiError(400, "Invalid relation reference");
        }
    }
    throw error;
}
export async function createClass(schoolId, payload) {
    await ensureAcademicYearBelongsToSchool(schoolId, payload.academicYearId);
    try {
        return await prisma.$transaction(async (tx) => {
            const existing = await tx.class.findFirst({
                where: {
                    schoolId,
                    academicYearId: payload.academicYearId,
                    className: { equals: payload.className, mode: "insensitive" },
                },
                select: { id: true, deletedAt: true },
            });
            if (existing && !existing.deletedAt) {
                throw new ApiError(409, "Class already exists for this academic year");
            }
            const totalSections = payload.totalSections;
            const capacity = payload.capacity;
            const sectionNames = Array.from({ length: totalSections }, (_, idx) => String.fromCharCode(65 + idx));
            if (existing?.id) {
                const classRecord = await tx.class.update({
                    where: { id: existing.id },
                    data: {
                        deletedAt: null,
                        className: payload.className,
                        classOrder: payload.classOrder,
                        isHalfDay: payload.isHalfDay ?? false,
                    },
                });
                await tx.section.updateMany({
                    where: {
                        classId: existing.id,
                        sectionName: { notIn: sectionNames },
                    },
                    data: { deletedAt: new Date() },
                });
                for (const sectionName of sectionNames) {
                    const existingSection = await tx.section.findFirst({
                        where: { classId: existing.id, sectionName },
                        select: { id: true },
                    });
                    if (existingSection) {
                        await tx.section.update({
                            where: { id: existingSection.id },
                            data: { deletedAt: null, capacity },
                        });
                    }
                    else {
                        await tx.section.create({
                            data: { classId: existing.id, sectionName, capacity },
                        });
                    }
                }
                return classRecord;
            }
            const classRecord = await tx.class.create({
                data: {
                    schoolId,
                    academicYearId: payload.academicYearId,
                    className: payload.className,
                    classOrder: payload.classOrder,
                    isHalfDay: payload.isHalfDay ?? false,
                },
            });
            const sectionData = sectionNames.map((sectionName) => ({
                classId: classRecord.id,
                sectionName,
                capacity,
            }));
            await tx.section.createMany({ data: sectionData });
            return classRecord;
        });
    }
    catch (error) {
        mapPrismaError(error);
    }
}
export async function listClasses(schoolId, academicYearId, pagination) {
    const resolvedAcademicYearId = academicYearId ?? (await getActiveAcademicYearId(schoolId));
    const where = {
        schoolId,
        academicYearId: resolvedAcademicYearId,
        deletedAt: null,
    };
    const [items, total] = await prisma.$transaction([
        prisma.class.findMany({
            where,
            include: {
                academicYear: {
                    select: {
                        id: true,
                        label: true,
                    },
                },
            },
            orderBy: [{ classOrder: "asc" }, { className: "asc" }],
            ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
        }),
        prisma.class.count({ where }),
    ]);
    return { items, total };
}
export async function getClassById(schoolId, id) {
    const classRecord = await prisma.class.findFirst({
        where: {
            id,
            schoolId,
            deletedAt: null,
        },
        include: {
            academicYear: {
                select: {
                    id: true,
                    label: true,
                },
            },
        },
    });
    if (!classRecord) {
        throw new ApiError(404, "Class not found");
    }
    return classRecord;
}
export async function updateClass(schoolId, id, payload) {
    await getClassById(schoolId, id);
    if (payload.academicYearId) {
        await ensureAcademicYearBelongsToSchool(schoolId, payload.academicYearId);
    }
    try {
        return await prisma.class.update({
            where: { id },
            data: {
                ...(payload.className !== undefined ? { className: payload.className } : {}),
                ...(payload.classOrder !== undefined ? { classOrder: payload.classOrder } : {}),
                ...(payload.academicYearId !== undefined
                    ? { academicYearId: payload.academicYearId }
                    : {}),
                ...(payload.isHalfDay !== undefined ? { isHalfDay: payload.isHalfDay } : {}),
            },
            include: {
                academicYear: {
                    select: {
                        id: true,
                        label: true,
                    },
                },
            },
        });
    }
    catch (error) {
        mapPrismaError(error);
    }
}
export async function deleteClass(schoolId, id) {
    await getClassById(schoolId, id);
    const classRecord = await prisma.class.update({
        where: { id },
        data: {
            deletedAt: new Date(),
            classTeacherId: null,
        },
        select: { id: true },
    });
    await prisma.section.updateMany({
        where: { classId: id, deletedAt: null },
        data: { deletedAt: new Date() },
    });
    return classRecord;
}
export async function assignClassTeacher(schoolId, payload) {
    const { classId, teacherId } = payload;
    const result = await prisma.$transaction(async (tx) => {
        const classRecord = await tx.class.findFirst({
            where: { id: classId, schoolId, deletedAt: null },
            select: { id: true, className: true, classTeacherId: true },
        });
        if (!classRecord) {
            throw new ApiError(404, "Class not found");
        }
        if (classRecord.classTeacherId) {
            throw new ApiError(400, "Class already has a class teacher");
        }
        const teacher = await tx.teacher.findFirst({
            where: { id: teacherId, schoolId, deletedAt: null },
            select: { id: true, fullName: true, userId: true },
        });
        if (!teacher) {
            throw new ApiError(404, "Teacher not found");
        }
        const existingAssignment = await tx.class.findFirst({
            where: { classTeacherId: teacherId, schoolId, deletedAt: null },
            select: { id: true },
        });
        if (existingAssignment) {
            throw new ApiError(400, "Teacher is already assigned as class teacher");
        }
        const updated = await tx.class.update({
            where: { id: classId },
            data: { classTeacherId: teacherId },
        });
        return { updated, classRecord, teacher };
    });
    try {
        const recipients = new Set();
        const classRecipients = await collectClassRecipients({
            schoolId,
            classId: result.classRecord.id,
        });
        classRecipients.forEach((id) => recipients.add(id));
        if (result.teacher.userId)
            recipients.add(result.teacher.userId);
        if (recipients.size) {
            await trigger("CLASS_TEACHER_ASSIGNED", {
                schoolId,
                classId: result.classRecord.id,
                className: result.classRecord.className,
                userIds: Array.from(recipients),
                metadata: {
                    teacherId: result.teacher.id,
                    teacherName: result.teacher.fullName,
                },
            });
        }
    }
    catch (error) {
        if (process.env.NODE_ENV !== "production") {
            console.error("[notify] class teacher assignment failed", error);
        }
    }
    return result.updated;
}
export async function removeClassTeacher(schoolId, payload) {
    const { classId } = payload;
    const classRecord = await prisma.class.findFirst({
        where: { id: classId, schoolId, deletedAt: null },
        select: { id: true },
    });
    if (!classRecord) {
        throw new ApiError(404, "Class not found");
    }
    return prisma.class.update({
        where: { id: classId },
        data: { classTeacherId: null },
    });
}
