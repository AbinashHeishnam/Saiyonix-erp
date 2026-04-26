import prisma from "@/core/db/prisma";
import { trigger } from "@/modules/notification/service";
import { collectClassRecipients } from "@/modules/notification/recipientUtils";
import { ApiError } from "@/core/errors/apiError";
import { safeRedisDel } from "@/core/cache/invalidate";
import { toLocalDateOnly } from "@/core/utils/localDate";
const prismaClient = prisma;
const DAY_OF_WEEK_NAMES = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
];
function mapPrismaError(error) {
    const code = error && typeof error === "object" && "code" in error
        ? String(error.code)
        : undefined;
    if (code === "P2002") {
        throw new ApiError(409, "Timetable slot conflict detected");
    }
    if (code === "P2003") {
        throw new ApiError(400, "Invalid relation reference");
    }
    throw error;
}
async function ensureAcademicYearBelongsToSchool(client, schoolId, academicYearId) {
    const academicYear = await client.academicYear.findFirst({
        where: { id: academicYearId, schoolId },
        select: { id: true },
    });
    if (!academicYear) {
        throw new ApiError(400, "Academic year not found for this school");
    }
}
async function ensureTeacherBelongsToSchool(client, schoolId, teacherId) {
    const teacher = await client.teacher.findFirst({
        where: { id: teacherId, schoolId, deletedAt: null },
        select: { id: true },
    });
    if (!teacher) {
        throw new ApiError(400, "Teacher not found for this school");
    }
}
async function getActiveAcademicYearId(client, schoolId) {
    const academicYear = await client.academicYear.findFirst({
        where: { schoolId, isActive: true },
        select: { id: true },
    });
    if (!academicYear) {
        throw new ApiError(400, "Active academic year not found");
    }
    return academicYear.id;
}
async function ensurePeriodBelongsToSchool(client, schoolId, periodId) {
    const period = await client.period.findFirst({
        where: { id: periodId, schoolId },
        select: { id: true },
    });
    if (!period) {
        throw new ApiError(400, "Period not found for this school");
    }
}
async function ensureSectionBelongsToSchool(client, schoolId, sectionId) {
    const section = await client.section.findFirst({
        where: {
            id: sectionId,
            deletedAt: null,
            class: { schoolId, deletedAt: null },
        },
        select: { id: true, classId: true, class: { select: { academicYearId: true } } },
    });
    if (!section) {
        throw new ApiError(400, "Section not found for this school");
    }
    return {
        ...section,
        academicYearId: section.class.academicYearId,
    };
}
async function ensureClassBelongsToSchool(client, schoolId, classId) {
    const classRecord = await client.class.findFirst({
        where: { id: classId, schoolId, deletedAt: null },
        select: { id: true, isHalfDay: true },
    });
    if (!classRecord) {
        throw new ApiError(400, "Class not found for this school");
    }
    return classRecord;
}
async function resolveEffectiveFrom(client, schoolId, effectiveFrom) {
    const school = await client.school.findUnique({
        where: { id: schoolId },
        select: { timezone: true },
    });
    const timeZone = school?.timezone ?? "Asia/Kolkata";
    const parsed = new Date(effectiveFrom);
    if (Number.isNaN(parsed.getTime())) {
        throw new ApiError(400, "Invalid effectiveFrom date");
    }
    return toLocalDateOnly(parsed, timeZone);
}
async function ensureClassSubjectBelongsToSchool(client, schoolId, classSubjectId) {
    const classSubject = await client.classSubject.findFirst({
        where: {
            id: classSubjectId,
            class: { schoolId, deletedAt: null },
            subject: { schoolId },
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
async function ensurePeriodLimitForDay(client, params) {
    const totalPeriods = await client.period.count({
        where: { schoolId: params.schoolId },
    });
    if (totalPeriods <= 0) {
        throw new ApiError(400, "Period configuration is missing for this school");
    }
    const classRecord = await ensureClassBelongsToSchool(client, params.schoolId, params.classId);
    const maxAllowed = classRecord.isHalfDay
        ? Math.floor(totalPeriods / 2)
        : totalPeriods;
    if (maxAllowed <= 0) {
        throw new ApiError(400, "Invalid half-day period configuration");
    }
    const existingCount = await client.timetableSlot.count({
        where: {
            sectionId: params.sectionId,
            dayOfWeek: params.dayOfWeek,
            effectiveFrom: params.effectiveFrom,
            ...(params.excludeId ? { NOT: { id: params.excludeId } } : {}),
        },
    });
    if (existingCount >= maxAllowed) {
        throw new ApiError(400, "Timetable exceeds the maximum periods allowed for the day");
    }
}
async function ensureTeacherAssignmentExists(client, params) {
    const assignment = await client.teacherSubjectClass.findFirst({
        where: {
            teacherId: params.teacherId,
            classSubjectId: params.classSubjectId,
            academicYearId: params.academicYearId,
            OR: [{ sectionId: params.sectionId }, { sectionId: null }],
            classSubject: {
                class: { schoolId: params.schoolId, deletedAt: null },
                subject: { schoolId: params.schoolId },
            },
        },
        select: { id: true },
    });
    if (!assignment) {
        throw new ApiError(400, "Teacher is not assigned to this subject/class/section for this academic year");
    }
}
async function ensureSectionMatchesClass(client, sectionId, classId) {
    const section = await client.section.findFirst({
        where: { id: sectionId, deletedAt: null, classId },
        select: { id: true },
    });
    if (!section) {
        throw new ApiError(400, "Section does not belong to the selected class");
    }
}
async function ensureNoSectionConflict(client, params) {
    const existing = await client.timetableSlot.findFirst({
        where: {
            sectionId: params.sectionId,
            dayOfWeek: params.dayOfWeek,
            periodId: params.periodId,
            effectiveFrom: params.effectiveFrom,
            ...(params.excludeId ? { NOT: { id: params.excludeId } } : {}),
        },
        select: { id: true },
    });
    if (existing) {
        throw new ApiError(409, "Section already has a timetable slot for this period");
    }
}
async function ensureNoTeacherConflict(client, params) {
    const existing = await client.timetableSlot.findFirst({
        where: {
            teacherId: params.teacherId,
            academicYearId: params.academicYearId,
            dayOfWeek: params.dayOfWeek,
            periodId: params.periodId,
            effectiveFrom: params.effectiveFrom,
            ...(params.excludeId ? { NOT: { id: params.excludeId } } : {}),
        },
        select: { id: true },
    });
    if (existing) {
        throw new ApiError(409, "Teacher is already assigned for this period");
    }
}
async function getTimetableSlotByIdWithClient(client, schoolId, id) {
    const record = await client.timetableSlot.findFirst({
        where: {
            id,
            section: {
                class: { schoolId, deletedAt: null },
                deletedAt: null,
            },
            classSubject: {
                class: { schoolId, deletedAt: null },
                subject: { schoolId },
            },
        },
        include: {
            section: true,
            classSubject: { include: { class: true, subject: true } },
            teacher: true,
            academicYear: true,
            period: true,
        },
    });
    if (!record) {
        throw new ApiError(404, "Timetable slot not found");
    }
    return record;
}
function mapDayOfWeek(dayOfWeek) {
    return DAY_OF_WEEK_NAMES[dayOfWeek - 1] ?? "UNKNOWN";
}
function toTimetableEntry(slot) {
    return {
        dayOfWeek: mapDayOfWeek(slot.dayOfWeek),
        periodNumber: slot.period.periodNumber,
        periodStartTime: slot.period?.startTime
            ? slot.period.startTime.toISOString().split("T")[1]?.slice(0, 5)
            : null,
        periodEndTime: slot.period?.endTime
            ? slot.period.endTime.toISOString().split("T")[1]?.slice(0, 5)
            : null,
        subjectName: slot.classSubject.subject.name,
        className: slot.section.class.className,
        sectionName: slot.section.sectionName,
        teacherName: slot.teacher?.fullName ?? null,
    };
}
async function invalidateTimetableCaches(params) {
    try {
        const sectionIds = Array.from(new Set(params.sectionIds.filter((id) => Boolean(id))));
        const teacherIds = Array.from(new Set(params.teacherIds.filter((id) => Boolean(id))));
        const keys = [];
        sectionIds.forEach((id) => keys.push(`timetable:section:${id}`));
        teacherIds.forEach((id) => {
            keys.push(`timetable:teacher:${id}`);
            if (params.academicYearId) {
                keys.push(`timetable:teacher:${id}:${params.academicYearId}`);
            }
            keys.push(`dashboard:teacher:${id}`);
        });
        if (sectionIds.length) {
            try {
                const enrollments = await prisma.studentEnrollment.findMany({
                    where: { sectionId: { in: sectionIds } },
                    select: { studentId: true },
                });
                enrollments.forEach((item) => {
                    keys.push(`timetable:student:${item.studentId}`);
                    keys.push(`dashboard:student:${item.studentId}`);
                });
            }
            catch (err) {
                console.error("[CACHE] timetable student lookup failed", err);
            }
        }
        if (keys.length) {
            await safeRedisDel(keys);
        }
    }
    catch (err) {
        console.error("[CACHE] timetable invalidation failed", err);
    }
}
export async function createTimetableSlot(schoolId, payload) {
    try {
        const created = await prisma.$transaction(async (tx) => {
            const db = tx;
            const section = await ensureSectionBelongsToSchool(db, schoolId, payload.sectionId);
            const classSubject = await ensureClassSubjectBelongsToSchool(db, schoolId, payload.classSubjectId);
            await ensureAcademicYearBelongsToSchool(db, schoolId, payload.academicYearId);
            await ensurePeriodBelongsToSchool(db, schoolId, payload.periodId);
            await ensureSectionMatchesClass(db, payload.sectionId, classSubject.classId);
            if (classSubject.academicYearId !== payload.academicYearId) {
                throw new ApiError(400, "Class subject does not belong to this academic year");
            }
            const effectiveFrom = await resolveEffectiveFrom(db, schoolId, payload.effectiveFrom);
            if (payload.teacherId) {
                await ensureTeacherBelongsToSchool(db, schoolId, payload.teacherId);
                await ensureTeacherAssignmentExists(db, {
                    schoolId,
                    teacherId: payload.teacherId,
                    classSubjectId: payload.classSubjectId,
                    sectionId: payload.sectionId,
                    academicYearId: payload.academicYearId,
                });
            }
            await ensurePeriodLimitForDay(db, {
                schoolId,
                sectionId: payload.sectionId,
                classId: section.classId,
                dayOfWeek: payload.dayOfWeek,
                effectiveFrom,
            });
            await ensureNoSectionConflict(db, {
                sectionId: payload.sectionId,
                dayOfWeek: payload.dayOfWeek,
                periodId: payload.periodId,
                effectiveFrom,
            });
            if (payload.teacherId) {
                await ensureNoTeacherConflict(db, {
                    teacherId: payload.teacherId,
                    academicYearId: payload.academicYearId,
                    dayOfWeek: payload.dayOfWeek,
                    periodId: payload.periodId,
                    effectiveFrom,
                });
            }
            return tx.timetableSlot.create({
                data: {
                    sectionId: payload.sectionId,
                    classSubjectId: payload.classSubjectId,
                    teacherId: payload.teacherId ?? null,
                    academicYearId: payload.academicYearId,
                    dayOfWeek: payload.dayOfWeek,
                    periodId: payload.periodId,
                    effectiveFrom,
                    roomNo: payload.roomNo,
                },
                include: {
                    section: true,
                    classSubject: { include: { class: true, subject: true } },
                    teacher: true,
                    academicYear: true,
                    period: true,
                },
            });
        });
        try {
            await invalidateTimetableCaches({
                sectionIds: [created.sectionId],
                teacherIds: [created.teacherId],
                academicYearId: created.academicYearId,
            });
        }
        catch {
            // ignore cache failures
        }
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
                const effectiveLabel = created.effectiveFrom
                    ? new Date(created.effectiveFrom).toLocaleDateString("en-IN")
                    : null;
                await trigger("TIMETABLE_UPDATED", {
                    schoolId,
                    classId: created.classSubject.classId,
                    className: created.classSubject.class?.className,
                    sectionId: created.sectionId,
                    sectionName: created.section?.sectionName ?? undefined,
                    subjectName: created.classSubject.subject?.name,
                    userIds: Array.from(recipients),
                    message: effectiveLabel
                        ? `The timetable has been updated for ${created.classSubject.class?.className ?? "your class"} effective ${effectiveLabel}.`
                        : undefined,
                    metadata: {
                        timetableSlotId: created.id,
                        effectiveFrom: created.effectiveFrom?.toISOString?.() ?? null,
                    },
                });
            }
        }
        catch (error) {
            if (process.env.NODE_ENV !== "production") {
                console.error("[notify] timetable update failed", error);
            }
        }
        return created;
    }
    catch (error) {
        mapPrismaError(error);
    }
}
export async function listTimetableSlots(schoolId, pagination) {
    const where = {
        section: {
            class: { schoolId, deletedAt: null },
            deletedAt: null,
        },
        classSubject: {
            class: { schoolId, deletedAt: null },
            subject: { schoolId },
        },
    };
    const [items, total] = await prisma.$transaction([
        prisma.timetableSlot.findMany({
            where,
            include: {
                section: true,
                classSubject: { include: { class: true, subject: true } },
                teacher: true,
                academicYear: true,
                period: true,
            },
            orderBy: [{ dayOfWeek: "asc" }, { period: { periodNumber: "asc" } }],
            ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
        }),
        prisma.timetableSlot.count({ where }),
    ]);
    return { items, total };
}
export async function getTimetableSlotById(schoolId, id) {
    return getTimetableSlotByIdWithClient(prismaClient, schoolId, id);
}
export async function updateTimetableSlot(schoolId, id, payload) {
    try {
        let previousSectionId = null;
        let previousTeacherId = null;
        const updated = await prisma.$transaction(async (tx) => {
            const db = tx;
            const existing = await getTimetableSlotByIdWithClient(db, schoolId, id);
            previousSectionId = existing.sectionId;
            previousTeacherId = existing.teacherId ?? null;
            const sectionId = payload.sectionId ?? existing.sectionId;
            const classSubjectId = payload.classSubjectId ?? existing.classSubjectId;
            const teacherId = payload.teacherId ?? existing.teacherId ?? undefined;
            const academicYearId = payload.academicYearId ?? existing.academicYearId;
            const dayOfWeek = payload.dayOfWeek ?? existing.dayOfWeek;
            const periodId = payload.periodId ?? existing.periodId;
            const effectiveFrom = payload.effectiveFrom
                ? await resolveEffectiveFrom(db, schoolId, payload.effectiveFrom)
                : existing.effectiveFrom;
            const section = await ensureSectionBelongsToSchool(db, schoolId, sectionId);
            const classSubject = await ensureClassSubjectBelongsToSchool(db, schoolId, classSubjectId);
            await ensureAcademicYearBelongsToSchool(db, schoolId, academicYearId);
            await ensurePeriodBelongsToSchool(db, schoolId, periodId);
            await ensureSectionMatchesClass(db, sectionId, classSubject.classId);
            if (classSubject.academicYearId !== academicYearId) {
                throw new ApiError(400, "Class subject does not belong to this academic year");
            }
            if (teacherId) {
                await ensureTeacherBelongsToSchool(db, schoolId, teacherId);
                await ensureTeacherAssignmentExists(db, {
                    schoolId,
                    teacherId,
                    classSubjectId,
                    sectionId,
                    academicYearId,
                });
            }
            await ensurePeriodLimitForDay(db, {
                schoolId,
                sectionId,
                classId: section.classId,
                dayOfWeek,
                effectiveFrom,
                excludeId: existing.id,
            });
            await ensureNoSectionConflict(db, {
                sectionId,
                dayOfWeek,
                periodId,
                effectiveFrom,
                excludeId: id,
            });
            if (teacherId) {
                await ensureNoTeacherConflict(db, {
                    teacherId,
                    academicYearId,
                    dayOfWeek,
                    periodId,
                    effectiveFrom,
                    excludeId: id,
                });
            }
            return tx.timetableSlot.update({
                where: { id },
                data: {
                    ...(payload.sectionId !== undefined ? { sectionId: payload.sectionId } : {}),
                    ...(payload.classSubjectId !== undefined
                        ? { classSubjectId: payload.classSubjectId }
                        : {}),
                    ...(payload.teacherId !== undefined ? { teacherId: payload.teacherId } : {}),
                    ...(payload.academicYearId !== undefined
                        ? { academicYearId: payload.academicYearId }
                        : {}),
                    ...(payload.dayOfWeek !== undefined ? { dayOfWeek: payload.dayOfWeek } : {}),
                    ...(payload.periodId !== undefined ? { periodId: payload.periodId } : {}),
                    ...(payload.effectiveFrom !== undefined
                        ? { effectiveFrom }
                        : {}),
                    ...(payload.roomNo !== undefined ? { roomNo: payload.roomNo } : {}),
                },
                include: {
                    section: true,
                    classSubject: { include: { class: true, subject: true } },
                    teacher: true,
                    academicYear: true,
                    period: true,
                },
            });
        });
        try {
            await invalidateTimetableCaches({
                sectionIds: [previousSectionId, updated.sectionId],
                teacherIds: [previousTeacherId, updated.teacherId],
                academicYearId: updated.academicYearId,
            });
        }
        catch {
            // ignore cache failures
        }
        return updated;
    }
    catch (error) {
        mapPrismaError(error);
    }
}
export async function deleteTimetableSlot(schoolId, id) {
    const existing = await getTimetableSlotById(schoolId, id);
    try {
        await prisma.timetableSlot.delete({
            where: { id },
        });
    }
    catch (error) {
        mapPrismaError(error);
    }
    try {
        await invalidateTimetableCaches({
            sectionIds: [existing.sectionId],
            teacherIds: [existing.teacherId ?? null],
            academicYearId: existing.academicYearId,
        });
    }
    catch {
        // ignore cache failures
    }
    return { id };
}
export async function listTimetableForSection(schoolId, sectionId) {
    const section = await ensureSectionBelongsToSchool(prismaClient, schoolId, sectionId);
    const dateOnly = await resolveEffectiveFrom(prisma, schoolId, new Date().toISOString());
    const rows = await prisma.timetableSlot.groupBy({
        by: ["sectionId"],
        where: {
            sectionId,
            academicYearId: section.academicYearId,
            effectiveFrom: { lte: dateOnly },
        },
        _max: { effectiveFrom: true },
    });
    const effectiveFrom = rows[0]?._max.effectiveFrom ?? null;
    if (!effectiveFrom) {
        return [];
    }
    const slots = await prisma.timetableSlot.findMany({
        where: {
            sectionId,
            academicYearId: section.academicYearId,
            effectiveFrom,
            section: {
                deletedAt: null,
                class: { schoolId, deletedAt: null },
            },
            classSubject: {
                class: { schoolId, deletedAt: null },
                subject: { schoolId },
            },
        },
        orderBy: [{ dayOfWeek: "asc" }, { period: { periodNumber: "asc" } }],
        select: {
            dayOfWeek: true,
            period: { select: { periodNumber: true, startTime: true, endTime: true } },
            classSubject: { select: { subject: { select: { name: true } } } },
            section: {
                select: { sectionName: true, class: { select: { className: true } } },
            },
            teacher: { select: { fullName: true } },
        },
    });
    return slots.map(toTimetableEntry);
}
export async function listTimetableForTeacher(schoolId, teacherId, academicYearId) {
    const resolvedAcademicYearId = academicYearId ?? (await getActiveAcademicYearId(prismaClient, schoolId));
    const teacher = await prisma.teacher.findFirst({
        where: { id: teacherId, schoolId, deletedAt: null },
        select: { id: true },
    });
    if (!teacher) {
        throw new ApiError(404, "Teacher not found");
    }
    const dateOnly = await resolveEffectiveFrom(prisma, schoolId, new Date().toISOString());
    const sectionRows = await prisma.timetableSlot.groupBy({
        by: ["sectionId"],
        where: {
            teacherId,
            academicYearId: resolvedAcademicYearId,
            effectiveFrom: { lte: dateOnly },
            section: {
                deletedAt: null,
                class: { schoolId, deletedAt: null },
            },
            classSubject: {
                class: { schoolId, deletedAt: null },
                subject: { schoolId },
            },
        },
        _max: { effectiveFrom: true },
    });
    const effectiveMap = new Map();
    const sectionIds = [];
    sectionRows.forEach((row) => {
        if (row.sectionId && row._max.effectiveFrom) {
            effectiveMap.set(row.sectionId, row._max.effectiveFrom);
            sectionIds.push(row.sectionId);
        }
    });
    const slots = await prisma.timetableSlot.findMany({
        where: {
            teacherId,
            academicYearId: resolvedAcademicYearId,
            sectionId: { in: sectionIds.length ? sectionIds : ["__none__"] },
            effectiveFrom: { lte: dateOnly },
            section: {
                deletedAt: null,
                class: { schoolId, deletedAt: null },
            },
            classSubject: {
                class: { schoolId, deletedAt: null },
                subject: { schoolId },
            },
        },
        orderBy: [{ dayOfWeek: "asc" }, { period: { periodNumber: "asc" } }],
        select: {
            dayOfWeek: true,
            period: { select: { periodNumber: true, startTime: true, endTime: true } },
            classSubject: { select: { subject: { select: { name: true } } } },
            section: {
                select: { sectionName: true, class: { select: { className: true } } },
            },
            teacher: { select: { fullName: true } },
            sectionId: true,
            effectiveFrom: true,
        },
    });
    const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { timezone: true },
    });
    const timeZone = school?.timezone ?? "Asia/Kolkata";
    const today = new Date();
    const substitutionDate = toLocalDateOnly(today, timeZone);
    const substitutions = await prisma.substitution.findMany({
        where: {
            substituteTeacherId: teacherId,
            date: substitutionDate,
            class: { schoolId, deletedAt: null, academicYearId: resolvedAcademicYearId },
            section: { deletedAt: null },
        },
        select: {
            absentTeacherId: true,
            absentTeacher: { select: { id: true, fullName: true } },
            timetableSlot: {
                select: {
                    dayOfWeek: true,
                    period: { select: { periodNumber: true, startTime: true, endTime: true } },
                    classSubject: { select: { subject: { select: { name: true } } } },
                    section: {
                        select: { sectionName: true, class: { select: { className: true } } },
                    },
                },
            },
        },
    });
    const entryKey = (entry) => `${entry.dayOfWeek}:${entry.periodNumber}:${entry.className}:${entry.sectionName}`;
    const entryMap = new Map();
    slots
        .filter((slot) => {
        const maxEffective = effectiveMap.get(slot.sectionId);
        return maxEffective ? slot.effectiveFrom.getTime() === maxEffective.getTime() : false;
    })
        .map(toTimetableEntry)
        .forEach((entry) => {
        entryMap.set(entryKey(entry), entry);
    });
    substitutions.forEach((sub) => {
        const baseSlot = sub.timetableSlot;
        if (!baseSlot)
            return;
        const entry = toTimetableEntry({
            dayOfWeek: baseSlot.dayOfWeek,
            period: baseSlot.period,
            classSubject: baseSlot.classSubject,
            section: baseSlot.section,
            teacher: { fullName: sub.absentTeacher?.fullName ?? "Teacher" },
        });
        const originalTeacherName = sub.absentTeacher?.fullName ?? "Teacher";
        entryMap.set(entryKey(entry), {
            ...entry,
            isSubstitution: true,
            originalTeacherId: sub.absentTeacherId ?? null,
            originalTeacherName,
            label: `Substitute for ${originalTeacherName}`,
        });
    });
    return Array.from(entryMap.values());
}
export async function listTimetableForStudent(schoolId, studentId) {
    const student = await prisma.student.findFirst({
        where: { id: studentId, schoolId, deletedAt: null },
        select: { id: true },
    });
    if (!student) {
        throw new ApiError(404, "Student not found");
    }
    const enrollment = await prisma.studentEnrollment.findFirst({
        where: {
            studentId,
            student: { schoolId, deletedAt: null },
        },
        orderBy: { createdAt: "desc" },
        select: {
            sectionId: true,
            academicYearId: true,
        },
    });
    if (!enrollment) {
        throw new ApiError(404, "Student enrollment not found");
    }
    const dateOnly = await resolveEffectiveFrom(prisma, schoolId, new Date().toISOString());
    const rows = await prisma.timetableSlot.groupBy({
        by: ["sectionId"],
        where: {
            sectionId: enrollment.sectionId,
            academicYearId: enrollment.academicYearId,
            effectiveFrom: { lte: dateOnly },
        },
        _max: { effectiveFrom: true },
    });
    const effectiveFrom = rows[0]?._max.effectiveFrom ?? null;
    if (!effectiveFrom) {
        return [];
    }
    const slots = await prisma.timetableSlot.findMany({
        where: {
            sectionId: enrollment.sectionId,
            academicYearId: enrollment.academicYearId,
            effectiveFrom,
            section: {
                deletedAt: null,
                class: { schoolId, deletedAt: null },
            },
            classSubject: {
                class: { schoolId, deletedAt: null },
                subject: { schoolId },
            },
        },
        orderBy: [{ dayOfWeek: "asc" }, { period: { periodNumber: "asc" } }],
        select: {
            dayOfWeek: true,
            period: { select: { periodNumber: true } },
            classSubject: { select: { subject: { select: { name: true } } } },
            section: {
                select: { sectionName: true, class: { select: { className: true } } },
            },
            teacher: { select: { fullName: true } },
        },
    });
    return slots.map(toTimetableEntry);
}
