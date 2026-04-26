import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { formatLocalDate, toLocalDateOnly } from "@/core/utils/localDate";
import { safeRedisDel } from "@/core/cache/invalidate";
import { trigger as triggerNotification } from "@/modules/notification/service";
import { canStudentInteractWithPreviousYear, getPreviousAcademicYear, } from "@/modules/academicYear/service";
const DAY_NAMES = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
];
function mapDay(dayOfWeek) {
    return DAY_NAMES[dayOfWeek - 1] ?? "UNKNOWN";
}
async function getTimetableLocked(client, schoolId) {
    const setting = await client.systemSetting.findFirst({
        where: { schoolId, settingKey: "TIMETABLE_LOCKED" },
        select: { settingValue: true },
    });
    if (setting?.settingValue === true)
        return true;
    if (typeof setting?.settingValue === "string") {
        return setting.settingValue.toLowerCase() === "true";
    }
    return false;
}
async function ensureTimetableNotLocked(client, schoolId) {
    const locked = await getTimetableLocked(client, schoolId);
    if (locked) {
        throw new ApiError(403, "Timetable is locked");
    }
}
async function ensureAcademicYearBelongsToSchool(client, schoolId, academicYearId) {
    const record = await client.academicYear.findFirst({
        where: { id: academicYearId, schoolId },
        select: { id: true },
    });
    if (!record) {
        throw new ApiError(400, "Academic year not found for this school");
    }
}
async function ensureSectionBelongsToSchool(client, schoolId, sectionId) {
    const section = await client.section.findFirst({
        where: {
            id: sectionId,
            deletedAt: null,
            class: { schoolId, deletedAt: null },
        },
        select: { id: true, classId: true, classTeacherId: true, class: { select: { academicYearId: true } } },
    });
    if (!section) {
        throw new ApiError(400, "Section not found for this school");
    }
    return {
        ...section,
        academicYearId: section.class.academicYearId,
    };
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
async function ensureClassBelongsToSchool(client, schoolId, classId) {
    const record = await client.class.findFirst({
        where: { id: classId, schoolId, deletedAt: null },
        select: { id: true, academicYearId: true },
    });
    if (!record) {
        throw new ApiError(400, "Class not found for this school");
    }
    return record;
}
async function ensurePeriodBelongsToSchool(client, schoolId, periodId) {
    const period = await client.period.findFirst({
        where: { id: periodId, schoolId },
        select: { id: true, isFirstPeriod: true, periodNumber: true },
    });
    if (!period) {
        throw new ApiError(400, "Period not found for this school");
    }
    return period;
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
async function resolveTargetDate(client, schoolId, value) {
    return resolveEffectiveFrom(client, schoolId, value ?? new Date().toISOString());
}
async function getEffectiveFromForSection(client, sectionId, academicYearId, date) {
    const rows = await client.timetableSlot.groupBy({
        by: ["sectionId"],
        where: {
            sectionId,
            academicYearId,
            effectiveFrom: { lte: date },
        },
        _max: { effectiveFrom: true },
    });
    return rows[0]?._max.effectiveFrom ?? null;
}
async function getEffectiveFromBySection(client, sectionIds, academicYearId, date) {
    if (sectionIds.length === 0)
        return new Map();
    const rows = await client.timetableSlot.groupBy({
        by: ["sectionId"],
        where: {
            sectionId: { in: sectionIds },
            academicYearId,
            effectiveFrom: { lte: date },
        },
        _max: { effectiveFrom: true },
    });
    const map = new Map();
    rows.forEach((row) => {
        if (row.sectionId && row._max.effectiveFrom) {
            map.set(row.sectionId, row._max.effectiveFrom);
        }
    });
    return map;
}
async function ensureSubjectBelongsToSchool(client, schoolId, subjectId) {
    const subject = await client.subject.findFirst({
        where: { id: subjectId, schoolId },
        select: { id: true },
    });
    if (!subject) {
        throw new ApiError(400, "Subject not found for this school");
    }
}
async function getConfiguredSubjectIds(client, classId) {
    const configs = await client.classSubjectConfig.findMany({
        where: { classId },
        select: { subjectId: true },
    });
    return configs.map((item) => item.subjectId);
}
async function resolveEffectiveFrom(client, schoolId, value) {
    const school = await client.school.findUnique({
        where: { id: schoolId },
        select: { timezone: true },
    });
    const timeZone = school?.timezone ?? "Asia/Kolkata";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new ApiError(400, "Invalid effectiveFrom date");
    }
    return toLocalDateOnly(parsed, timeZone);
}
async function ensureNoTeacherConflict(client, params) {
    const existing = await client.timetableSlot.findFirst({
        where: {
            teacherId: params.teacherId,
            academicYearId: params.academicYearId,
            dayOfWeek: params.dayOfWeek,
            periodId: params.periodId,
            effectiveFrom: params.effectiveFrom,
        },
        select: { id: true, sectionId: true, classSubjectId: true },
    });
    if (!existing)
        return;
    const sameSlot = existing.sectionId === params.sectionId &&
        (params.classSubjectId ? existing.classSubjectId === params.classSubjectId : true);
    if (sameSlot)
        return;
    throw new ApiError(409, "Teacher already assigned at this time");
}
async function ensureClassSubjectForSlot(client, params) {
    await ensureSubjectBelongsToSchool(client, params.schoolId, params.subjectId);
    const configuredSubjectIds = await getConfiguredSubjectIds(client, params.classId);
    if (configuredSubjectIds.length > 0 && !configuredSubjectIds.includes(params.subjectId)) {
        throw new ApiError(400, "Subject is not configured for this class");
    }
    const existing = await client.classSubject.findFirst({
        where: {
            classId: params.classId,
            subjectId: params.subjectId,
            class: { schoolId: params.schoolId, deletedAt: null },
            subject: { schoolId: params.schoolId },
        },
        select: { id: true },
    });
    if (existing) {
        return existing.id;
    }
    const created = await client.classSubject.create({
        data: {
            classId: params.classId,
            subjectId: params.subjectId,
            periodsPerWeek: 1,
        },
        select: { id: true },
    });
    return created.id;
}
async function validateSlot(client, schoolId, params) {
    await ensureAcademicYearBelongsToSchool(client, schoolId, params.academicYearId);
    const section = await ensureSectionBelongsToSchool(client, schoolId, params.sectionId);
    await ensurePeriodBelongsToSchool(client, schoolId, params.periodId);
    await ensureTeacherBelongsToSchool(client, schoolId, params.teacherId);
    await ensureSubjectBelongsToSchool(client, schoolId, params.subjectId);
    const classSubject = await client.classSubject.findFirst({
        where: {
            classId: section.classId,
            subjectId: params.subjectId,
            class: { schoolId, deletedAt: null },
            subject: { schoolId },
        },
        select: { id: true },
    });
    const effectiveFrom = params.effectiveFrom
        ? await resolveEffectiveFrom(client, schoolId, params.effectiveFrom)
        : await resolveEffectiveFrom(client, schoolId, new Date().toISOString());
    await ensureNoTeacherConflict(client, {
        teacherId: params.teacherId,
        academicYearId: params.academicYearId,
        dayOfWeek: params.dayOfWeek,
        periodId: params.periodId,
        effectiveFrom,
        sectionId: params.sectionId,
        classSubjectId: classSubject?.id ?? null,
    });
    const existingSectionSlot = await client.timetableSlot.findFirst({
        where: {
            sectionId: params.sectionId,
            dayOfWeek: params.dayOfWeek,
            periodId: params.periodId,
            effectiveFrom,
        },
        select: { id: true, classSubjectId: true, teacherId: true },
    });
    if (existingSectionSlot) {
        const sameSlot = (classSubject?.id ? existingSectionSlot.classSubjectId === classSubject.id : true) &&
            existingSectionSlot.teacherId === params.teacherId;
        if (!sameSlot) {
            throw new ApiError(409, "Section already has a class at this time");
        }
    }
}
export async function validateTimetableSlot(schoolId, payload) {
    try {
        await validateSlot(prisma, schoolId, payload);
        return { hasConflict: false };
    }
    catch (error) {
        if (error instanceof ApiError) {
            return { hasConflict: true, reason: error.message };
        }
        return { hasConflict: true, reason: "Validation failed" };
    }
}
export async function bulkCreateTimetable(schoolId, payload) {
    const result = await prisma.$transaction(async (tx) => {
        const db = tx;
        await ensureTimetableNotLocked(db, schoolId);
        const effectiveFrom = await resolveEffectiveFrom(db, schoolId, payload.effectiveFrom);
        if (payload.overwrite) {
            await tx.timetableSlot.deleteMany({
                where: {
                    sectionId: payload.sectionId,
                    academicYearId: payload.academicYearId,
                    effectiveFrom: { gte: effectiveFrom },
                },
            });
        }
        await ensureAcademicYearBelongsToSchool(db, schoolId, payload.academicYearId);
        const section = await ensureSectionBelongsToSchool(db, schoolId, payload.sectionId);
        const periodFirstMap = new Map();
        const periods = await tx.period.findMany({
            where: { schoolId },
            select: { id: true, isFirstPeriod: true },
        });
        periods.forEach((p) => periodFirstMap.set(p.id, Boolean(p.isFirstPeriod)));
        const seen = new Set();
        const classSubjectMap = new Map();
        for (const slot of payload.slots) {
            const key = `${slot.dayOfWeek}:${slot.periodId}`;
            if (seen.has(key)) {
                throw new ApiError(400, "Duplicate period in payload");
            }
            seen.add(key);
            const isFirst = periodFirstMap.get(slot.periodId) ?? false;
            const teacherId = isFirst && section.classTeacherId ? section.classTeacherId : slot.teacherId;
            const classSubjectId = await ensureClassSubjectForSlot(db, {
                schoolId,
                classId: section.classId,
                subjectId: slot.subjectId,
            });
            classSubjectMap.set(key, classSubjectId);
            await validateSlot(db, schoolId, {
                ...slot,
                teacherId,
                sectionId: payload.sectionId,
                academicYearId: payload.academicYearId,
                effectiveFrom: payload.effectiveFrom,
            });
        }
        const created = await Promise.all(payload.slots.map((slot) => {
            const isFirst = periodFirstMap.get(slot.periodId) ?? false;
            const teacherId = isFirst && section.classTeacherId ? section.classTeacherId : slot.teacherId;
            const key = `${slot.dayOfWeek}:${slot.periodId}`;
            const classSubjectId = classSubjectMap.get(key);
            if (!classSubjectId) {
                throw new ApiError(400, "Class subject mapping not found");
            }
            return tx.timetableSlot.create({
                data: {
                    sectionId: payload.sectionId,
                    academicYearId: payload.academicYearId,
                    dayOfWeek: slot.dayOfWeek,
                    periodId: slot.periodId,
                    classSubjectId,
                    teacherId,
                    effectiveFrom,
                },
            });
        }));
        return { count: created.length };
    });
    try {
        const teacherIds = payload.slots
            .map((slot) => slot.teacherId ?? null)
            .filter((id) => Boolean(id));
        await invalidateTimetableCaches({
            sectionIds: [payload.sectionId],
            teacherIds,
            academicYearId: payload.academicYearId,
        });
    }
    catch {
        // ignore cache failures
    }
    return result;
}
function groupByDay(slots) {
    const grouped = {};
    slots.forEach((slot) => {
        const day = mapDay(slot.dayOfWeek);
        if (!grouped[day])
            grouped[day] = [];
        grouped[day].push(slot);
    });
    Object.values(grouped).forEach((arr) => arr.sort((a, b) => (a.period?.periodNumber ?? 0) - (b.period?.periodNumber ?? 0)));
    return grouped;
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
export async function getSectionTimetable(schoolId, sectionId, date) {
    const section = await ensureSectionBelongsToSchool(prisma, schoolId, sectionId);
    const dateOnly = await resolveTargetDate(prisma, schoolId, date);
    const effectiveFrom = await getEffectiveFromForSection(prisma, sectionId, section.academicYearId, dateOnly);
    if (!effectiveFrom) {
        return groupByDay([]);
    }
    const slots = await prisma.timetableSlot.findMany({
        where: {
            sectionId,
            academicYearId: section.academicYearId,
            effectiveFrom,
            section: { deletedAt: null, class: { schoolId, deletedAt: null } },
        },
        include: {
            period: true,
            classSubject: { include: { subject: true } },
            teacher: { select: { id: true, fullName: true } },
            section: { include: { class: true } },
        },
        orderBy: [{ dayOfWeek: "asc" }, { period: { periodNumber: "asc" } }],
    });
    return groupByDay(slots);
}
export async function getTeacherTimetable(schoolId, teacherId, academicYearId, date) {
    await ensureTeacherBelongsToSchool(prisma, schoolId, teacherId);
    const resolvedAcademicYearId = academicYearId ?? (await getActiveAcademicYearId(prisma, schoolId));
    const dateOnly = await resolveTargetDate(prisma, schoolId, date);
    const sectionRows = await prisma.timetableSlot.groupBy({
        by: ["sectionId"],
        where: {
            teacherId,
            academicYearId: resolvedAcademicYearId,
            effectiveFrom: { lte: dateOnly },
            section: { deletedAt: null, class: { schoolId, deletedAt: null } },
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
    if (sectionIds.length === 0) {
        return groupByDay([]);
    }
    const slots = await prisma.timetableSlot.findMany({
        where: {
            teacherId,
            academicYearId: resolvedAcademicYearId,
            sectionId: { in: sectionIds },
            effectiveFrom: { lte: dateOnly },
            section: { deletedAt: null, class: { schoolId, deletedAt: null } },
        },
        include: {
            period: true,
            classSubject: { include: { subject: true } },
            section: { include: { class: true } },
        },
        orderBy: [{ dayOfWeek: "asc" }, { period: { periodNumber: "asc" } }],
    });
    const filteredSlots = slots.filter((slot) => {
        const maxEffective = effectiveMap.get(slot.sectionId);
        return maxEffective ? slot.effectiveFrom.getTime() === maxEffective.getTime() : false;
    });
    const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { timezone: true },
    });
    const timeZone = school?.timezone ?? "Asia/Kolkata";
    const today = new Date();
    const dateOnlyForSubs = toLocalDateOnly(today, timeZone);
    const substitutions = await prisma.substitution.findMany({
        where: {
            substituteTeacherId: teacherId,
            date: dateOnlyForSubs,
            class: { schoolId, deletedAt: null, academicYearId: resolvedAcademicYearId },
            section: { deletedAt: null },
        },
        select: {
            absentTeacherId: true,
            absentTeacher: { select: { id: true, fullName: true } },
            timetableSlotId: true,
            timetableSlot: {
                include: {
                    period: true,
                    classSubject: { include: { subject: true } },
                    section: { include: { class: true } },
                },
            },
        },
    });
    const slotMap = new Map();
    filteredSlots.forEach((slot) => slotMap.set(slot.id, slot));
    substitutions.forEach((sub) => {
        const baseSlot = sub.timetableSlot;
        if (!baseSlot)
            return;
        const originalTeacherName = sub.absentTeacher?.fullName ?? "Teacher";
        slotMap.set(sub.timetableSlotId, {
            ...baseSlot,
            teacherId,
            isSubstitution: true,
            originalTeacherId: sub.absentTeacherId ?? null,
            originalTeacherName,
            label: `Substitute for ${originalTeacherName}`,
        });
    });
    return groupByDay(Array.from(slotMap.values()));
}
function getLocalDayOfWeek(date, timeZone) {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
    });
    const day = dtf.format(date);
    const map = {
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
        Sun: 7,
    };
    return map[day] ?? date.getDay();
}
export async function getTeacherTodaySchedule(schoolId, userId) {
    const teacher = await prisma.teacher.findFirst({
        where: { schoolId, userId, deletedAt: null },
        select: { id: true },
    });
    if (!teacher) {
        throw new ApiError(404, "Teacher not found");
    }
    const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { timezone: true },
    });
    const timeZone = school?.timezone ?? "Asia/Kolkata";
    const today = new Date();
    const dayOfWeek = getLocalDayOfWeek(today, timeZone);
    const dateOnly = toLocalDateOnly(today, timeZone);
    const academicYearId = await getActiveAcademicYearId(prisma, schoolId);
    const holiday = await prisma.holiday.findFirst({
        where: { schoolId, holidayDate: dateOnly },
        select: { id: true, title: true, isHalfDay: true },
    });
    if (holiday && !holiday.isHalfDay) {
        return { holiday: holiday.title, slots: [] };
    }
    const totalPeriods = await prisma.period.count({ where: { schoolId } });
    const sectionRows = await prisma.timetableSlot.groupBy({
        by: ["sectionId"],
        where: {
            teacherId: teacher.id,
            academicYearId,
            effectiveFrom: { lte: dateOnly },
            section: { deletedAt: null, class: { schoolId, deletedAt: null } },
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
            teacherId: teacher.id,
            dayOfWeek,
            academicYearId,
            sectionId: { in: sectionIds.length ? sectionIds : ["__none__"] },
            effectiveFrom: { lte: dateOnly },
            section: { deletedAt: null, class: { schoolId, deletedAt: null } },
        },
        include: {
            period: true,
            section: { include: { class: true } },
            classSubject: { include: { subject: true } },
        },
        orderBy: { period: { periodNumber: "asc" } },
    });
    const filteredSlots = slots.filter((slot) => {
        const maxEffective = effectiveMap.get(slot.sectionId);
        return maxEffective ? slot.effectiveFrom.getTime() === maxEffective.getTime() : false;
    });
    const filtered = filteredSlots.filter((slot) => {
        const isHalfDay = slot.section?.class?.isHalfDay ?? false;
        const halfDayMode = isHalfDay || Boolean(holiday?.isHalfDay);
        if (!halfDayMode)
            return true;
        const maxAllowed = Math.floor(totalPeriods / 2);
        return (slot.period?.periodNumber ?? 0) <= maxAllowed;
    });
    const substitutions = await prisma.substitution.findMany({
        where: {
            date: dateOnly,
            substituteTeacherId: teacher.id,
            class: { schoolId, deletedAt: null, academicYearId },
            section: { deletedAt: null },
        },
        select: {
            absentTeacherId: true,
            absentTeacher: { select: { id: true, fullName: true } },
            timetableSlotId: true,
            timetableSlot: {
                include: {
                    period: true,
                    section: { include: { class: true } },
                    classSubject: { include: { subject: true } },
                },
            },
        },
    });
    const slotMap = new Map();
    filtered.forEach((slot) => slotMap.set(slot.id, slot));
    substitutions.forEach((sub) => {
        const baseSlot = sub.timetableSlot;
        if (!baseSlot)
            return;
        const originalTeacherName = sub.absentTeacher?.fullName ?? "Teacher";
        slotMap.set(sub.timetableSlotId, {
            ...baseSlot,
            teacherId: teacher.id,
            isSubstitution: true,
            originalTeacherId: sub.absentTeacherId ?? null,
            originalTeacherName,
            label: `Substitute for ${originalTeacherName}`,
        });
    });
    const filteredForTeacher = Array.from(slotMap.values()).filter((slot) => slot.teacherId === teacher.id);
    return { holiday: holiday?.title ?? null, slots: filteredForTeacher };
}
export async function getStudentTimetableForUser(schoolId, userId, date) {
    const student = await prisma.student.findFirst({
        where: { schoolId, userId, deletedAt: null },
        select: { id: true },
    });
    if (!student) {
        throw new ApiError(404, "Student not found");
    }
    let enrollment = await prisma.studentEnrollment.findFirst({
        where: { studentId: student.id },
        orderBy: { createdAt: "desc" },
        select: { sectionId: true, academicYearId: true },
    });
    if (enrollment && (await canStudentInteractWithPreviousYear(schoolId))) {
        const previousYear = await getPreviousAcademicYear(schoolId);
        if (previousYear?.id) {
            const previousEnrollment = await prisma.studentEnrollment.findFirst({
                where: {
                    studentId: student.id,
                    academicYearId: previousYear.id,
                },
                orderBy: { createdAt: "desc" },
                select: { sectionId: true, academicYearId: true },
            });
            if (previousEnrollment) {
                enrollment = previousEnrollment;
            }
        }
    }
    if (!enrollment) {
        throw new ApiError(404, "Student enrollment not found");
    }
    const dateOnly = await resolveTargetDate(prisma, schoolId, date);
    const effectiveFrom = await getEffectiveFromForSection(prisma, enrollment.sectionId, enrollment.academicYearId, dateOnly);
    if (!effectiveFrom) {
        return groupByDay([]);
    }
    const slots = await prisma.timetableSlot.findMany({
        where: {
            sectionId: enrollment.sectionId,
            academicYearId: enrollment.academicYearId,
            effectiveFrom,
            section: { deletedAt: null, class: { schoolId, deletedAt: null } },
        },
        include: {
            period: true,
            classSubject: { include: { subject: true } },
            teacher: { select: { id: true, fullName: true } },
            section: { include: { class: true } },
        },
        orderBy: [{ dayOfWeek: "asc" }, { period: { periodNumber: "asc" } }],
    });
    return groupByDay(slots);
}
export async function getParentTimetableForUser(schoolId, userId, date) {
    const parent = await prisma.parent.findFirst({
        where: { schoolId, userId },
        include: {
            studentLinks: {
                include: {
                    student: {
                        include: {
                            enrollments: {
                                orderBy: { createdAt: "desc" },
                                take: 1,
                                include: { section: true },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!parent || parent.studentLinks.length === 0) {
        return [];
    }
    const previousYearId = (await canStudentInteractWithPreviousYear(schoolId))
        ? (await getPreviousAcademicYear(schoolId))?.id ?? null
        : null;
    const results = [];
    for (const link of parent.studentLinks) {
        const student = link.student;
        if (!student)
            continue;
        const enrollment = student.enrollments?.[0];
        if (previousYearId && enrollment?.studentId) {
            const previousEnrollment = await prisma.studentEnrollment.findFirst({
                where: {
                    studentId: enrollment.studentId,
                    academicYearId: previousYearId,
                },
                orderBy: { createdAt: "desc" },
                select: { sectionId: true, academicYearId: true },
            });
            if (previousEnrollment) {
                const effectiveEnrollment = previousEnrollment;
                if (!effectiveEnrollment.sectionId)
                    continue;
                const dateOnly = await resolveTargetDate(prisma, schoolId, date);
                const effectiveFrom = await getEffectiveFromForSection(prisma, effectiveEnrollment.sectionId, effectiveEnrollment.academicYearId, dateOnly);
                if (!effectiveFrom) {
                    results.push({
                        studentId: student.id,
                        studentName: student.fullName ?? null,
                        sectionId: effectiveEnrollment.sectionId,
                        slots: [],
                    });
                    continue;
                }
                const slots = await prisma.timetableSlot.findMany({
                    where: {
                        sectionId: effectiveEnrollment.sectionId,
                        academicYearId: effectiveEnrollment.academicYearId,
                        effectiveFrom,
                        section: { deletedAt: null, class: { schoolId, deletedAt: null } },
                    },
                    include: {
                        classSubject: { include: { subject: true } },
                        teacher: true,
                        period: true,
                    },
                    orderBy: [{ dayOfWeek: "asc" }, { period: { periodNumber: "asc" } }],
                });
                results.push({
                    studentId: student.id,
                    studentName: student.fullName ?? null,
                    sectionId: effectiveEnrollment.sectionId,
                    slots,
                });
                continue;
            }
        }
        if (!enrollment?.sectionId)
            continue;
        const dateOnly = await resolveTargetDate(prisma, schoolId, date);
        const effectiveFrom = await getEffectiveFromForSection(prisma, enrollment.sectionId, enrollment.academicYearId, dateOnly);
        if (!effectiveFrom) {
            results.push({
                studentId: student.id,
                studentName: student.fullName ?? null,
                sectionId: enrollment.sectionId,
                slots: [],
            });
            continue;
        }
        const slots = await prisma.timetableSlot.findMany({
            where: {
                sectionId: enrollment.sectionId,
                academicYearId: enrollment.academicYearId,
                effectiveFrom,
                section: { deletedAt: null, class: { schoolId, deletedAt: null } },
            },
            include: {
                classSubject: { include: { subject: true } },
                teacher: true,
                period: true,
            },
            orderBy: [{ dayOfWeek: "asc" }, { period: { periodNumber: "asc" } }],
        });
        results.push({
            studentId: student.id,
            studentName: student.fullName ?? null,
            sectionId: enrollment.sectionId,
            slots,
        });
    }
    console.log("Parent timetable result:", results);
    return results;
}
export async function getTimetableLockStatus(schoolId) {
    const locked = await getTimetableLocked(prisma, schoolId);
    return { locked };
}
export async function setTimetableLock(schoolId, locked) {
    await prisma.systemSetting.upsert({
        where: { schoolId_settingKey: { schoolId, settingKey: "TIMETABLE_LOCKED" } },
        update: { settingValue: locked },
        create: { schoolId, settingKey: "TIMETABLE_LOCKED", settingValue: locked },
    });
    return { locked };
}
export async function getTimetableWorkload(schoolId) {
    const academicYear = await prisma.academicYear.findFirst({
        where: { schoolId, isActive: true },
        select: { id: true },
    });
    if (!academicYear) {
        throw new ApiError(400, "Active academic year not found");
    }
    const thresholdSetting = await prisma.systemSetting.findFirst({
        where: { schoolId, settingKey: "TIMETABLE_OVERLOAD_THRESHOLD" },
        select: { settingValue: true },
    });
    const threshold = typeof thresholdSetting?.settingValue === "number"
        ? thresholdSetting.settingValue
        : typeof thresholdSetting?.settingValue === "string"
            ? Number.parseInt(thresholdSetting.settingValue, 10)
            : 30;
    const grouped = await prisma.timetableSlot.groupBy({
        by: ["teacherId"],
        where: {
            academicYearId: academicYear.id,
            teacherId: { not: null },
            section: { class: { schoolId, deletedAt: null }, deletedAt: null },
        },
        _count: { _all: true },
    });
    const teacherIds = grouped.map((g) => g.teacherId).filter(Boolean);
    const teachers = await prisma.teacher.findMany({
        where: { id: { in: teacherIds }, schoolId, deletedAt: null },
        select: { id: true, fullName: true },
    });
    const nameMap = new Map(teachers.map((t) => [t.id, t.fullName ?? "Teacher"]));
    return grouped.map((item) => ({
        teacherId: item.teacherId,
        teacherName: nameMap.get(item.teacherId) ?? "Teacher",
        totalPeriods: item._count._all,
        isOverloaded: item._count._all > threshold,
    }));
}
export async function getTimetableOptions(schoolId, params) {
    await ensureAcademicYearBelongsToSchool(prisma, schoolId, params.academicYearId);
    const classRecord = await ensureClassBelongsToSchool(prisma, schoolId, params.classId);
    if (classRecord.academicYearId !== params.academicYearId) {
        throw new ApiError(400, "Class does not belong to this academic year");
    }
    const section = await ensureSectionBelongsToSchool(prisma, schoolId, params.sectionId);
    if (section.classId !== params.classId) {
        throw new ApiError(400, "Section does not belong to this class");
    }
    const subjects = await prisma.classSubject.findMany({
        where: {
            classId: params.classId,
            class: { schoolId, deletedAt: null },
            subject: { schoolId },
        },
        include: {
            subject: true,
            class: { select: { id: true, className: true } },
        },
        orderBy: { subject: { name: "asc" } },
    });
    const teachers = await prisma.teacherSubjectClass.findMany({
        where: {
            academicYearId: params.academicYearId,
            classSubject: {
                classId: params.classId,
                class: { schoolId, deletedAt: null },
                subject: { schoolId },
            },
            OR: [{ sectionId: params.sectionId }, { sectionId: null }],
        },
        include: {
            teacher: { select: { id: true, fullName: true } },
        },
        orderBy: { teacher: { fullName: "asc" } },
    });
    return { subjects, teachers };
}
export async function getTimetableMeta(schoolId, sectionId) {
    const section = await ensureSectionBelongsToSchool(prisma, schoolId, sectionId);
    const configuredSubjects = await prisma.classSubjectConfig.findMany({
        where: { classId: section.classId },
        select: { subjectId: true, subject: { select: { id: true, name: true } } },
        orderBy: { subject: { name: "asc" } },
    });
    const subjects = configuredSubjects.length > 0
        ? configuredSubjects.map((item) => item.subject)
        : await prisma.subject.findMany({
            where: { schoolId },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        });
    const teachers = await prisma.teacher.findMany({
        where: { schoolId, deletedAt: null },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
    });
    return {
        subjects,
        teachers,
        classTeacherId: section.classTeacherId ?? null,
    };
}
export async function deleteTimetableSlot(schoolId, payload) {
    await ensureTimetableNotLocked(prisma, schoolId);
    const section = await ensureSectionBelongsToSchool(prisma, schoolId, payload.sectionId);
    const dateOnly = await resolveTargetDate(prisma, schoolId);
    const effectiveFrom = payload.effectiveFrom
        ? await resolveEffectiveFrom(prisma, schoolId, payload.effectiveFrom)
        : await getEffectiveFromForSection(prisma, payload.sectionId, section.academicYearId, dateOnly);
    await prisma.timetableSlot.deleteMany({
        where: {
            sectionId: payload.sectionId,
            dayOfWeek: payload.dayOfWeek,
            periodId: payload.periodId,
            ...(effectiveFrom ? { effectiveFrom } : {}),
        },
    });
    try {
        await invalidateTimetableCaches({
            sectionIds: [payload.sectionId],
            teacherIds: [],
        });
    }
    catch {
        // ignore cache failures
    }
    return { ok: true };
}
export async function createSubstitution(schoolId, payload) {
    await ensureTimetableNotLocked(prisma, schoolId);
    const slot = await prisma.timetableSlot.findFirst({
        where: {
            id: payload.timetableSlotId,
            section: { class: { schoolId, deletedAt: null }, deletedAt: null },
        },
        include: {
            period: true,
            section: { include: { class: true } },
            classSubject: { include: { subject: true } },
        },
    });
    if (!slot) {
        throw new ApiError(404, "Timetable slot not found");
    }
    await ensureTeacherBelongsToSchool(prisma, schoolId, payload.substituteTeacherId);
    const date = new Date(payload.substitutionDate);
    if (Number.isNaN(date.getTime())) {
        throw new ApiError(400, "Invalid substitutionDate");
    }
    const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { timezone: true },
    });
    const timeZone = school?.timezone ?? "Asia/Kolkata";
    const dateOnly = toLocalDateOnly(date, timeZone);
    const today = toLocalDateOnly(new Date(), timeZone);
    if (dateOnly < today) {
        throw new ApiError(400, "Cannot create substitution for past date");
    }
    await prisma.substitution.deleteMany({
        where: {
            date: { lt: today },
            class: { schoolId, deletedAt: null },
        },
    });
    if (!slot.section?.classId) {
        throw new ApiError(400, "Class not found for timetable slot");
    }
    const conflictSlot = await prisma.timetableSlot.findFirst({
        where: {
            teacherId: payload.substituteTeacherId,
            academicYearId: slot.academicYearId,
            dayOfWeek: slot.dayOfWeek,
            periodId: slot.periodId,
        },
        select: { id: true },
    });
    if (conflictSlot) {
        throw new ApiError(409, "Substitute teacher already assigned at this time");
    }
    const conflictSub = await prisma.substitution.findFirst({
        where: {
            substituteTeacherId: payload.substituteTeacherId,
            date: dateOnly,
            timetableSlot: {
                dayOfWeek: slot.dayOfWeek,
                periodId: slot.periodId,
            },
        },
        select: { id: true },
    });
    if (conflictSub) {
        throw new ApiError(409, "Substitute teacher already assigned at this time");
    }
    const conflictSubDay = await prisma.substitution.findFirst({
        where: {
            substituteTeacherId: payload.substituteTeacherId,
            date: dateOnly,
        },
        select: { id: true },
    });
    if (conflictSubDay) {
        throw new ApiError(409, "Substitute teacher already assigned for this day");
    }
    const result = await prisma.substitution.upsert({
        where: {
            timetableSlotId_date: {
                timetableSlotId: payload.timetableSlotId,
                date: dateOnly,
            },
        },
        update: {
            substituteTeacherId: payload.substituteTeacherId,
            reason: payload.reason,
            periodId: slot.periodId,
            classId: slot.section.classId,
            sectionId: slot.sectionId,
            absentTeacherId: slot.teacherId ?? null,
            isClassTeacherSubstitution: slot.section.classTeacherId === slot.teacherId,
        },
        create: {
            timetableSlotId: payload.timetableSlotId,
            date: dateOnly,
            substituteTeacherId: payload.substituteTeacherId,
            reason: payload.reason,
            periodId: slot.periodId,
            classId: slot.section.classId,
            sectionId: slot.sectionId,
            absentTeacherId: slot.teacherId ?? null,
            isClassTeacherSubstitution: slot.section.classTeacherId === slot.teacherId,
        },
    });
    try {
        const [substituteTeacher, absentTeacher] = await Promise.all([
            prisma.teacher.findFirst({
                where: { id: payload.substituteTeacherId, schoolId, deletedAt: null },
                select: { id: true, userId: true, fullName: true },
            }),
            slot.teacherId
                ? prisma.teacher.findFirst({
                    where: { id: slot.teacherId, schoolId, deletedAt: null },
                    select: { id: true, fullName: true },
                })
                : Promise.resolve(null),
        ]);
        if (substituteTeacher?.userId) {
            const className = slot.section?.class?.className ?? "Class";
            const sectionName = slot.section?.sectionName ?? "";
            const classLabel = sectionName ? `${className}-${sectionName}` : className;
            const subjectName = slot.classSubject?.subject?.name ?? "Subject";
            const periodLabel = slot.period?.periodNumber
                ? `${slot.period.periodNumber} period`
                : "period";
            const dateLabel = formatLocalDate(dateOnly, timeZone);
            const absentName = absentTeacher?.fullName ?? "Teacher";
            await triggerNotification("SUBSTITUTION_ASSIGNED", {
                schoolId,
                userIds: [substituteTeacher.userId],
                title: "Emergency Substitution Assigned",
                body: `You have been assigned to substitute for ${absentName} in ${classLabel} (${subjectName}, ${periodLabel}) on ${dateLabel}.`,
                entityType: "TIMETABLE",
                linkUrl: "/teacher/timetable",
                metadata: {
                    eventType: "SUBSTITUTION_ASSIGNED",
                    substitutionId: result.id,
                    timetableSlotId: slot.id,
                    substituteTeacherId: substituteTeacher.id,
                    absentTeacherId: slot.teacherId ?? null,
                    date: dateLabel,
                },
            });
        }
    }
    catch {
        // ignore notification failures
    }
    try {
        await invalidateTimetableCaches({
            sectionIds: [slot.sectionId],
            teacherIds: [slot.teacherId, payload.substituteTeacherId],
            academicYearId: slot.academicYearId,
        });
    }
    catch {
        // ignore cache failures
    }
    return result;
}
