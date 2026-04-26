import { Prisma } from "@prisma/client";
import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
function mapPrismaError(error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
            throw new ApiError(409, "Academic year with this label already exists");
        }
        if (error.code === "P2003") {
            throw new ApiError(400, "Invalid relation reference");
        }
    }
    throw error;
}
async function resolveCloneSource(tx, schoolId, payload) {
    if (payload.cloneFromAcademicYearId) {
        const source = await tx.academicYear.findFirst({
            where: { id: payload.cloneFromAcademicYearId, schoolId },
            select: { id: true, label: true },
        });
        if (!source) {
            throw new ApiError(404, "Clone source academic year not found");
        }
        return source;
    }
    if (payload.cloneFromPrevious) {
        const source = await tx.academicYear.findFirst({
            where: { schoolId },
            orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
            select: { id: true, label: true },
        });
        if (!source) {
            throw new ApiError(400, "No previous academic year found to clone");
        }
        return source;
    }
    return null;
}
async function cloneAcademicYearStructure(params) {
    const { tx, schoolId, sourceAcademicYearId, targetAcademicYearId } = params;
    const periodScope = await tx.$queryRaw(Prisma.sql `
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('Period', 'period')
      AND column_name IN ('academicYearId', 'academic_year_id')
    LIMIT 1
  `);
    const periodTable = periodScope.length > 0
        ? periodScope[0].table_name === "period"
            ? "period"
            : "Period"
        : null;
    const periodColumn = periodScope.length > 0
        ? periodScope[0].column_name === "academic_year_id"
            ? "academic_year_id"
            : "academicYearId"
        : null;
    if (periodTable && periodColumn) {
        const tableId = Prisma.raw(`"${periodTable}"`);
        const colId = Prisma.raw(`"${periodColumn}"`);
        const existingPeriods = await tx.$queryRaw(Prisma.sql `
      SELECT COUNT(*)::int AS count
      FROM ${tableId}
      WHERE "schoolId" = ${schoolId} AND ${colId} = ${targetAcademicYearId}
    `);
        if ((existingPeriods[0]?.count ?? 0) > 0) {
            throw new ApiError(400, "Target academic year already has period data");
        }
        const sourcePeriods = await tx.$queryRaw(Prisma.sql `
      SELECT COUNT(*)::int AS count
      FROM ${tableId}
      WHERE "schoolId" = ${schoolId} AND ${colId} = ${sourceAcademicYearId}
    `);
        if ((sourcePeriods[0]?.count ?? 0) === 0) {
            throw new ApiError(400, "Source academic year has no periods to clone");
        }
        await tx.$executeRaw(Prisma.sql `
      INSERT INTO ${tableId} ("schoolId", ${colId}, "periodNumber", "startTime", "endTime", "isLunch", "isFirstPeriod")
      SELECT "schoolId", ${targetAcademicYearId}, "periodNumber", "startTime", "endTime", "isLunch", "isFirstPeriod"
      FROM ${tableId}
      WHERE "schoolId" = ${schoolId} AND ${colId} = ${sourceAcademicYearId}
    `);
    }
    const existingCount = await tx.class.count({
        where: { schoolId, academicYearId: targetAcademicYearId, deletedAt: null },
    });
    if (existingCount > 0) {
        throw new ApiError(400, "Target academic year already has class data");
    }
    const sourceClasses = await tx.class.findMany({
        where: { schoolId, academicYearId: sourceAcademicYearId, deletedAt: null },
        include: {
            sections: {
                where: { deletedAt: null },
                select: { sectionName: true, capacity: true },
            },
            classSubjects: {
                select: { subjectId: true, periodsPerWeek: true },
            },
            classSubjectConfigs: {
                select: { subjectId: true },
            },
        },
        orderBy: [{ classOrder: "asc" }, { className: "asc" }],
    });
    if (sourceClasses.length === 0) {
        return;
    }
    const anyClassSubjects = sourceClasses.some((cls) => cls.classSubjects.length > 0);
    if (!anyClassSubjects) {
        throw new ApiError(400, "Source academic year has no class-subject mappings to clone");
    }
    for (const cls of sourceClasses) {
        if (cls.sections.length === 0) {
            throw new ApiError(400, `Class ${cls.className} has no sections to clone`);
        }
    }
    const classIdMap = new Map();
    for (const cls of sourceClasses) {
        const created = await tx.class.create({
            data: {
                schoolId,
                academicYearId: targetAcademicYearId,
                className: cls.className,
                classOrder: cls.classOrder,
                isHalfDay: cls.isHalfDay ?? false,
                classTeacherId: null,
            },
            select: { id: true },
        });
        if (!created?.id) {
            throw new ApiError(500, `Failed to clone class ${cls.className}`);
        }
        classIdMap.set(cls.id, created.id);
    }
    if (classIdMap.size !== sourceClasses.length) {
        throw new ApiError(500, "Class clone mapping incomplete");
    }
    const sectionRows = [];
    const classSubjectRows = [];
    const classSubjectConfigRows = [];
    for (const cls of sourceClasses) {
        const newClassId = classIdMap.get(cls.id);
        if (!newClassId) {
            throw new ApiError(500, `Class mapping missing for ${cls.className}`);
        }
        for (const section of cls.sections) {
            sectionRows.push({
                classId: newClassId,
                sectionName: section.sectionName,
                capacity: section.capacity ?? null,
                classTeacherId: null,
            });
        }
        for (const mapping of cls.classSubjects) {
            classSubjectRows.push({
                classId: newClassId,
                subjectId: mapping.subjectId,
                periodsPerWeek: mapping.periodsPerWeek,
            });
        }
        for (const config of cls.classSubjectConfigs) {
            classSubjectConfigRows.push({
                classId: newClassId,
                subjectId: config.subjectId,
            });
        }
    }
    if (sectionRows.length > 0) {
        await tx.section.createMany({ data: sectionRows, skipDuplicates: true });
    }
    if (classSubjectRows.length > 0) {
        await tx.classSubject.createMany({ data: classSubjectRows, skipDuplicates: true });
    }
    if (classSubjectConfigRows.length > 0) {
        await tx.classSubjectConfig.createMany({
            data: classSubjectConfigRows,
            skipDuplicates: true,
        });
    }
}
async function resetOperationalData(params) {
    const { tx, schoolId, academicYearId, startDate, endDate } = params;
    const [teacherAssignments, timetableSlots, studentAttendance, sectionAttendance] = await Promise.all([
        tx.teacherSubjectClass.count({ where: { academicYearId } }),
        tx.timetableSlot.count({ where: { academicYearId } }),
        tx.studentAttendance.count({ where: { academicYearId } }),
        tx.sectionAttendance.count({ where: { academicYearId } }),
    ]);
    if (teacherAssignments > 0 ||
        timetableSlots > 0 ||
        studentAttendance > 0 ||
        sectionAttendance > 0) {
        throw new ApiError(400, "Target academic year already has operational data. Disable resetOperationalData to avoid data loss.");
    }
    await tx.teacherSubjectClass.deleteMany({ where: { academicYearId } });
    await tx.timetableSlot.deleteMany({ where: { academicYearId } });
    await tx.studentAttendance.deleteMany({ where: { academicYearId } });
    await tx.sectionAttendance.deleteMany({ where: { academicYearId } });
}
export async function createAcademicYear(schoolId, payload) {
    try {
        return await prisma.$transaction(async (tx) => {
            const db = tx;
            const source = await resolveCloneSource(db, schoolId, payload);
            const created = await tx.academicYear.create({
                data: {
                    schoolId,
                    label: payload.label,
                    startDate: payload.startDate,
                    endDate: payload.endDate,
                    isActive: payload.isActive ?? false,
                    isLocked: payload.isLocked ?? false,
                },
            });
            if (payload.isActive) {
                await tx.academicYear.updateMany({
                    where: { schoolId, id: { not: created.id }, isActive: true },
                    data: { isActive: false },
                });
            }
            if (source) {
                await cloneAcademicYearStructure({
                    tx: db,
                    schoolId,
                    sourceAcademicYearId: source.id,
                    targetAcademicYearId: created.id,
                });
            }
            return created;
        });
    }
    catch (error) {
        mapPrismaError(error);
    }
}
export async function listAcademicYears(schoolId, pagination) {
    const where = { schoolId };
    const [items, total] = await prisma.$transaction([
        prisma.academicYear.findMany({
            where,
            orderBy: [{ startDate: "desc" }, { label: "asc" }],
            ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
        }),
        prisma.academicYear.count({ where }),
    ]);
    return { items, total };
}
export async function getAcademicYearById(schoolId, id) {
    const academicYear = await prisma.academicYear.findFirst({
        where: {
            id,
            schoolId,
        },
    });
    if (!academicYear) {
        throw new ApiError(404, "Academic year not found");
    }
    return academicYear;
}
export async function updateAcademicYear(schoolId, id, payload) {
    await getAcademicYearById(schoolId, id);
    try {
        return await prisma.$transaction(async (tx) => {
            const updated = await tx.academicYear.update({
                where: { id },
                data: {
                    ...(payload.label !== undefined ? { label: payload.label } : {}),
                    ...(payload.startDate !== undefined ? { startDate: payload.startDate } : {}),
                    ...(payload.endDate !== undefined ? { endDate: payload.endDate } : {}),
                    ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
                    ...(payload.isLocked !== undefined ? { isLocked: payload.isLocked } : {}),
                },
            });
            if (payload.isActive) {
                await tx.academicYear.updateMany({
                    where: { schoolId, id: { not: id }, isActive: true },
                    data: { isActive: false },
                });
            }
            return updated;
        });
    }
    catch (error) {
        mapPrismaError(error);
    }
}
export async function switchAcademicYear(schoolId, payload, actorUserId) {
    const toYear = await prisma.academicYear.findFirst({
        where: { id: payload.toAcademicYearId, schoolId },
    });
    if (!toYear) {
        throw new ApiError(404, "Target academic year not found");
    }
    const fromYear = payload.fromAcademicYearId != null
        ? await prisma.academicYear.findFirst({
            where: { id: payload.fromAcademicYearId, schoolId },
        })
        : await prisma.academicYear.findFirst({
            where: { schoolId, isActive: true },
        });
    if (fromYear && fromYear.id === toYear.id) {
        throw new ApiError(400, "Target academic year is already active");
    }
    await prisma.$transaction(async (tx) => {
        const db = tx;
        await tx.academicYear.updateMany({
            where: { schoolId, isActive: true },
            data: { isActive: false },
        });
        await tx.academicYear.update({
            where: { id: toYear.id },
            data: { isActive: true },
        });
        if (fromYear) {
            await tx.academicYear.update({
                where: { id: fromYear.id },
                data: { isActive: false },
            });
        }
        if (payload.resetOperationalData) {
            await resetOperationalData({
                tx: db,
                schoolId,
                academicYearId: toYear.id,
                startDate: toYear.startDate,
                endDate: toYear.endDate,
            });
        }
        await tx.systemSetting.upsert({
            where: { schoolId_settingKey: { schoolId, settingKey: "ACADEMIC_YEAR_SWITCH" } },
            create: {
                schoolId,
                settingKey: "ACADEMIC_YEAR_SWITCH",
                settingValue: {
                    fromAcademicYearId: fromYear?.id ?? null,
                    toAcademicYearId: toYear.id,
                    switchedAt: new Date().toISOString(),
                },
                updatedById: actorUserId ?? null,
            },
            update: {
                settingValue: {
                    fromAcademicYearId: fromYear?.id ?? null,
                    toAcademicYearId: toYear.id,
                    switchedAt: new Date().toISOString(),
                },
                updatedById: actorUserId ?? null,
            },
        });
    });
    return {
        fromAcademicYearId: fromYear?.id ?? null,
        toAcademicYearId: toYear.id,
        resetOperationalData: Boolean(payload.resetOperationalData),
    };
}
const STUDENT_TRANSITION_DAYS = 50;
const TEACHER_TRANSITION_DAYS = 50;
export async function getActiveAcademicYear(schoolId) {
    const active = await prisma.academicYear.findFirst({
        where: { schoolId, isActive: true },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });
    if (!active) {
        throw new ApiError(400, "Active academic year not found");
    }
    return active;
}
export async function getPreviousAcademicYear(schoolId) {
    const setting = await prisma.systemSetting.findFirst({
        where: { schoolId, settingKey: "ACADEMIC_YEAR_SWITCH" },
        select: { settingValue: true },
    });
    const value = setting?.settingValue;
    if (value?.fromAcademicYearId) {
        const previous = await prisma.academicYear.findFirst({
            where: { schoolId, id: value.fromAcademicYearId },
        });
        if (previous)
            return previous;
    }
    const active = await getActiveAcademicYear(schoolId);
    const previous = await prisma.academicYear.findFirst({
        where: { schoolId, startDate: { lt: active.startDate } },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });
    return previous ?? null;
}
export async function getAcademicYearTransitionMeta(schoolId) {
    const setting = await prisma.systemSetting.findFirst({
        where: { schoolId, settingKey: "ACADEMIC_YEAR_SWITCH" },
        select: { settingValue: true },
    });
    if (!setting?.settingValue) {
        return null;
    }
    const value = setting.settingValue;
    if (!value?.switchedAt || !value?.toAcademicYearId) {
        return null;
    }
    const [fromYear, toYear] = await Promise.all([
        value.fromAcademicYearId
            ? prisma.academicYear.findFirst({
                where: { id: value.fromAcademicYearId, schoolId },
            })
            : null,
        prisma.academicYear.findFirst({
            where: { id: value.toAcademicYearId, schoolId },
        }),
    ]);
    if (!toYear) {
        return null;
    }
    const switchedAt = new Date(value.switchedAt);
    const studentEndsAt = new Date(switchedAt.getTime() + STUDENT_TRANSITION_DAYS * 86400000);
    const teacherEndsAt = new Date(switchedAt.getTime() + TEACHER_TRANSITION_DAYS * 86400000);
    const now = Date.now();
    return {
        fromAcademicYear: fromYear,
        toAcademicYear: toYear,
        switchedAt: switchedAt.toISOString(),
        studentWindowEndsAt: studentEndsAt.toISOString(),
        teacherWindowEndsAt: teacherEndsAt.toISOString(),
        canStudentInteract: now <= studentEndsAt.getTime(),
        canTeacherInteract: now <= teacherEndsAt.getTime(),
    };
}
export async function canStudentInteractWithPreviousYear(schoolId) {
    const meta = await getAcademicYearTransitionMeta(schoolId);
    return Boolean(meta?.canStudentInteract);
}
export async function canClassTeacherInteractWithPreviousYear(schoolId) {
    const meta = await getAcademicYearTransitionMeta(schoolId);
    return Boolean(meta?.canTeacherInteract);
}
export async function deleteAcademicYear(schoolId, id) {
    await getAcademicYearById(schoolId, id);
    try {
        await prisma.academicYear.delete({
            where: { id },
        });
    }
    catch (error) {
        mapPrismaError(error);
    }
    return { id };
}
