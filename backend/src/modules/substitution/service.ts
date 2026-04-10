import { Prisma } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { formatLocalDateKey, toLocalDateOnly } from "@/core/utils/localDate";

type DbClient = typeof prisma;

type GenerateParams = {
  schoolId: string;
  teacherId: string;
  fromDate: Date;
  toDate: Date;
  createdById?: string | null;
};

type ListAdminParams = {
  schoolId: string;
  date?: string | null;
  teacherId?: string | null;
  classId?: string | null;
  academicYearId?: string | null;
  includeAvailability?: boolean;
  pagination: { skip: number; take: number };
};

function addDaysUTC(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function getLocalDayOfWeek(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  });
  const day = dtf.format(date);
  const map: Record<string, number> = {
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

async function getActiveAcademicYearId(client: DbClient, schoolId: string) {
  const academicYear = await client.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true },
  });
  if (!academicYear) {
    throw new ApiError(400, "Active academic year not found");
  }
  return academicYear.id;
}

export async function generateSubstitutions(client: DbClient, params: GenerateParams) {
  const school = await client.school.findUnique({
    where: { id: params.schoolId },
    select: { timezone: true },
  });
  const timeZone = school?.timezone ?? "Asia/Kolkata";

  const fromDate = toLocalDateOnly(params.fromDate, timeZone);
  const toDate = toLocalDateOnly(params.toDate, timeZone);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new ApiError(400, "Invalid leave date range");
  }

  if (fromDate > toDate) {
    throw new ApiError(400, "Invalid leave date range");
  }

  const academicYear = await client.academicYear.findFirst({
    where: { schoolId: params.schoolId, isActive: true },
    select: { id: true },
  });
  if (!academicYear) {
    throw new ApiError(400, "Active academic year not found");
  }

  const dateRange: Date[] = [];
  for (let d = fromDate; d <= toDate; d = addDaysUTC(d, 1)) {
    dateRange.push(new Date(d));
  }

  const dayOfWeeks = Array.from(new Set(dateRange.map((d) => getLocalDayOfWeek(d, timeZone))));

  const absentSlots = await client.timetableSlot.findMany({
    where: {
      teacherId: params.teacherId,
      academicYearId: academicYear.id,
      dayOfWeek: { in: dayOfWeeks },
      section: { deletedAt: null, class: { schoolId: params.schoolId, deletedAt: null } },
    },
    include: {
      period: true,
      section: { include: { class: true } },
      classSubject: { include: { subject: true } },
    },
  });

  if (!absentSlots.length) {
    // TODO(substitution): handle teachers with no timetable assignments explicitly in UI/reporting.
    return { created: 0, skipped: 0 };
  }

  const slotsByDay = new Map<number, typeof absentSlots>();
  const periodIdsByDay = new Map<number, Set<string>>();
  for (const slot of absentSlots) {
    const list = slotsByDay.get(slot.dayOfWeek) ?? [];
    list.push(slot);
    slotsByDay.set(slot.dayOfWeek, list);
    const periodSet = periodIdsByDay.get(slot.dayOfWeek) ?? new Set<string>();
    periodSet.add(slot.periodId);
    periodIdsByDay.set(slot.dayOfWeek, periodSet);
  }

  const teachers = await client.teacher.findMany({
    where: { schoolId: params.schoolId, deletedAt: null },
    select: { id: true, fullName: true },
  });

  const teacherIds = teachers.map((t) => t.id);
  if (!teacherIds.length) {
    return { created: 0, skipped: absentSlots.length * dateRange.length };
  }

  const teacherLeaves = await client.teacherLeave.findMany({
    where: {
      teacher: { schoolId: params.schoolId, deletedAt: null },
      status: "APPROVED",
      fromDate: { lte: toDate },
      toDate: { gte: fromDate },
    },
    select: { teacherId: true, fromDate: true, toDate: true },
  });

  // TODO(substitution): support partial-day/period-based leave once leave records include periods.
  const leaveSetByDate = new Map<string, Set<string>>();
  for (const leave of teacherLeaves) {
    const leaveFrom = toLocalDateOnly(leave.fromDate, timeZone);
    const leaveTo = toLocalDateOnly(leave.toDate, timeZone);
    for (let d = leaveFrom; d <= leaveTo; d = addDaysUTC(d, 1)) {
      if (d < fromDate || d > toDate) continue;
      const dk = formatLocalDateKey(d, timeZone);
      const set = leaveSetByDate.get(dk) ?? new Set<string>();
      set.add(leave.teacherId);
      leaveSetByDate.set(dk, set);
    }
  }

  const timetableAssignments = await client.timetableSlot.findMany({
    where: {
      teacherId: { in: teacherIds },
      academicYearId: academicYear.id,
      dayOfWeek: { in: dayOfWeeks },
    },
    select: { teacherId: true, dayOfWeek: true, periodId: true },
  });

  const assignmentByDayPeriod = new Map<string, Set<string>>();
  const workloadByTeacherDay = new Map<string, number>();
  for (const slot of timetableAssignments) {
    if (!slot.teacherId) continue;
    const key = `${slot.dayOfWeek}:${slot.periodId}`;
    const set = assignmentByDayPeriod.get(key) ?? new Set<string>();
    set.add(slot.teacherId);
    assignmentByDayPeriod.set(key, set);
    const workloadKey = `${slot.teacherId}:${slot.dayOfWeek}`;
    workloadByTeacherDay.set(workloadKey, (workloadByTeacherDay.get(workloadKey) ?? 0) + 1);
  }

  const existingSubs = await client.substitution.findMany({
    where: { date: { gte: fromDate, lte: toDate }, class: { schoolId: params.schoolId } },
    select: { timetableSlotId: true, date: true, periodId: true, substituteTeacherId: true },
  });

  const existingSubBySlot = new Map<string, string | null>();
  const unavailableMap = new Set<string>();
  const workloadByTeacherDate = new Map<string, number>();
  const teacherIdsSorted = [...teacherIds].sort((a, b) => a.localeCompare(b));

  const unavailableKey = (teacherId: string, dk: string, periodId: string) =>
    `${teacherId}:${dk}:${periodId}`;
  for (const date of dateRange) {
    const dayOfWeek = getLocalDayOfWeek(date, timeZone);
    const dk = formatLocalDateKey(date, timeZone);
    const leaveSet = leaveSetByDate.get(dk);
    const periodSet = periodIdsByDay.get(dayOfWeek);
    for (const teacherId of teacherIds) {
      const base = workloadByTeacherDay.get(`${teacherId}:${dayOfWeek}`) ?? 0;
      workloadByTeacherDate.set(`${teacherId}:${dk}`, base);
    }
    if (periodSet) {
      for (const periodId of periodSet) {
        // Mark absent teacher unavailable for all periods in the leave range.
        unavailableMap.add(unavailableKey(params.teacherId, dk, periodId));
        const assignmentSet = assignmentByDayPeriod.get(`${dayOfWeek}:${periodId}`);
        if (assignmentSet) {
          for (const teacherId of assignmentSet) {
            unavailableMap.add(unavailableKey(teacherId, dk, periodId));
          }
        }
        if (leaveSet) {
          for (const teacherId of leaveSet) {
            unavailableMap.add(unavailableKey(teacherId, dk, periodId));
          }
        }
      }
    }
  }

  for (const sub of existingSubs) {
    const dk = formatLocalDateKey(sub.date, timeZone);
    existingSubBySlot.set(`${sub.timetableSlotId}:${dk}`, sub.substituteTeacherId ?? null);
    if (sub.substituteTeacherId) {
      unavailableMap.add(unavailableKey(sub.substituteTeacherId, dk, sub.periodId));
      const key = `${sub.substituteTeacherId}:${dk}`;
      workloadByTeacherDate.set(key, (workloadByTeacherDate.get(key) ?? 0) + 1);
    }
  }

  const holidays = await client.holiday.findMany({
    where: {
      schoolId: params.schoolId,
      holidayDate: { gte: fromDate, lte: toDate },
    },
    select: { holidayDate: true, isHalfDay: true },
  });
  const holidayMap = new Map<string, { isHalfDay: boolean }>();
  for (const holiday of holidays) {
    holidayMap.set(formatLocalDateKey(holiday.holidayDate, timeZone), { isHalfDay: holiday.isHalfDay });
  }

  const subjectTeacherMap = new Map<string, Set<string>>();
  const subjectTeachers = await client.teacherSubjectClass.findMany({
    where: {
      academicYearId: academicYear.id,
      teacher: { schoolId: params.schoolId, deletedAt: null },
    },
    select: { teacherId: true, classSubject: { select: { subjectId: true } } },
  });
  for (const row of subjectTeachers) {
    if (!row.classSubject?.subjectId) continue;
    const set = subjectTeacherMap.get(row.classSubject.subjectId) ?? new Set<string>();
    set.add(row.teacherId);
    subjectTeacherMap.set(row.classSubject.subjectId, set);
  }

  let created = 0;
  let skipped = 0;

  for (const date of dateRange) {
    const dayOfWeek = getLocalDayOfWeek(date, timeZone);
    const slots = slotsByDay.get(dayOfWeek) ?? [];
    const dk = formatLocalDateKey(date, timeZone);
    const assignedTeacherForDay = new Set<string>();
    const holiday = holidayMap.get(dk);
    if (holiday && !holiday.isHalfDay) {
      // TODO(substitution): handle holiday-aware substitution policies (skip/non-teaching days).
      skipped += slots.length;
      continue;
    }

    for (const slot of slots) {
      const existingKey = `${slot.id}:${dk}`;
      const existingSub = existingSubBySlot.get(existingKey);
      if (existingSub !== null && existingSub !== undefined) {
        skipped += 1;
        continue;
      }

      let substituteTeacherId: string | null = null;
      const subjectId = slot.classSubject?.subjectId ?? null;
      const subjectTeachersSet = subjectId ? subjectTeacherMap.get(subjectId) : undefined;
      const pickCandidate = (subjectOnly: boolean) => {
        let bestId: string | null = null;
        let bestLoad = Number.POSITIVE_INFINITY;
        for (const teacherId of teacherIdsSorted) {
          if (subjectOnly && subjectTeachersSet && !subjectTeachersSet.has(teacherId)) {
            continue;
          }
          if (assignedTeacherForDay.has(teacherId)) continue;
          if (unavailableMap.has(unavailableKey(teacherId, dk, slot.periodId))) continue;
          const load = workloadByTeacherDate.get(`${teacherId}:${dk}`) ?? 0;
          if (load < bestLoad) {
            bestLoad = load;
            bestId = teacherId;
          }
        }
        return bestId;
      };

      if (subjectTeachersSet && subjectTeachersSet.size) {
        substituteTeacherId = pickCandidate(true);
      }
      if (!substituteTeacherId) {
        substituteTeacherId = pickCandidate(false);
      }

      await client.substitution.upsert({
        where: {
          timetableSlotId_date: {
            timetableSlotId: slot.id,
            date: toLocalDateOnly(date, timeZone),
          },
        },
        update: {
          substituteTeacherId,
          absentTeacherId: params.teacherId,
          periodId: slot.periodId,
          classId: slot.section.classId,
          sectionId: slot.sectionId,
          isClassTeacherSubstitution: slot.section.classTeacherId === params.teacherId,
          ...(substituteTeacherId ? { reason: "AUTO_ASSIGNED" } : { reason: "UNASSIGNED" }),
        },
        create: {
          timetableSlotId: slot.id,
          date: toLocalDateOnly(date, timeZone),
          substituteTeacherId,
          absentTeacherId: params.teacherId,
          periodId: slot.periodId,
          classId: slot.section.classId,
          sectionId: slot.sectionId,
          isClassTeacherSubstitution: slot.section.classTeacherId === params.teacherId,
          reason: substituteTeacherId ? "AUTO_ASSIGNED" : "UNASSIGNED",
          createdById: params.createdById ?? null,
        },
      });

      if (substituteTeacherId) {
        assignedTeacherForDay.add(substituteTeacherId);
        unavailableMap.add(unavailableKey(substituteTeacherId, dk, slot.periodId));
        const key = `${substituteTeacherId}:${dk}`;
        workloadByTeacherDate.set(key, (workloadByTeacherDate.get(key) ?? 0) + 1);
      }
      created += 1;
    }
  }

  return { created, skipped };
}

export async function getTeacherSubstitutionsToday(schoolId: string, userId: string) {
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
  const today = toLocalDateOnly(new Date(), timeZone);
  const academicYearId = await getActiveAcademicYearId(prisma, schoolId);
  await prisma.substitution.deleteMany({
    where: {
      date: { lt: today },
      class: { schoolId, deletedAt: null, academicYearId },
    },
  });

  const substitutions = await prisma.substitution.findMany({
    where: {
      substituteTeacherId: teacher.id,
      date: today,
      class: { schoolId, deletedAt: null, academicYearId },
    },
    include: {
      period: true,
      class: true,
      section: true,
      absentTeacher: { select: { id: true, fullName: true } },
      timetableSlot: {
        include: { classSubject: { include: { subject: true } } },
      },
    },
    orderBy: { period: { periodNumber: "asc" } },
  });

  return substitutions;
}

export async function listSubstitutionsAdmin(params: ListAdminParams) {
  const resolvedAcademicYearId =
    params.academicYearId ?? (await getActiveAcademicYearId(prisma, params.schoolId));
  const where: Prisma.SubstitutionWhereInput = {
    class: { schoolId: params.schoolId, deletedAt: null, academicYearId: resolvedAcademicYearId },
  };

  let timeZone = "Asia/Kolkata";
  let dateOnly: Date | null = null;
  if (params.date || params.includeAvailability) {
    const school = await prisma.school.findUnique({
      where: { id: params.schoolId },
      select: { timezone: true },
    });
    timeZone = school?.timezone ?? "Asia/Kolkata";
  }

  const today = toLocalDateOnly(new Date(), timeZone);
  await prisma.substitution.deleteMany({
    where: {
      date: { lt: today },
      class: { schoolId: params.schoolId, deletedAt: null, academicYearId: resolvedAcademicYearId },
    },
  });

  if (params.date) {
    const date = new Date(params.date);
    if (!Number.isNaN(date.getTime())) {
      dateOnly = toLocalDateOnly(date, timeZone);
      where.date = dateOnly;
    }
  }

  if (params.teacherId) {
    where.OR = [
      { absentTeacherId: params.teacherId },
      { substituteTeacherId: params.teacherId },
    ];
  }

  if (params.classId) {
    where.classId = params.classId;
  }

  const [items, total] = await Promise.all([
    prisma.substitution.findMany({
      where,
      include: {
        period: true,
        class: true,
        section: true,
        absentTeacher: { select: { id: true, fullName: true } },
        substituteTeacher: { select: { id: true, fullName: true } },
        timetableSlot: {
          include: { classSubject: { include: { subject: true } } },
        },
      },
      orderBy: [{ date: "desc" }, { period: { periodNumber: "asc" } }],
      skip: params.pagination.skip,
      take: params.pagination.take,
    }),
    prisma.substitution.count({ where }),
  ]);

  let availability: {
    periodId: string;
    periodNumber: number;
    freeTeachers: { id: string; fullName: string | null }[];
  }[] = [];

  let approvedLeaves: {
    id: string;
    teacherId: string;
    fromDate: Date;
    toDate: Date;
    reason: string | null;
    leaveType: string | null;
    teacher: { id: string; fullName: string | null; employeeId: string | null };
    slots?: {
      id: string;
      period: { id: string; periodNumber: number; startTime?: Date | null; endTime?: Date | null };
      class: { id: string; className: string | null };
      section: { id: string; sectionName: string | null };
      subject: { id: string; name: string | null };
    }[];
  }[] = [];

  let dayOfWeek: number | null = null;
  if (dateOnly) {
    approvedLeaves = await prisma.teacherLeave.findMany({
      where: {
        teacher: { schoolId: params.schoolId, deletedAt: null },
        status: "APPROVED",
        fromDate: { lte: dateOnly },
        toDate: { gte: dateOnly },
      },
      select: {
        id: true,
        teacherId: true,
        fromDate: true,
        toDate: true,
        reason: true,
        leaveType: true,
        teacher: { select: { id: true, fullName: true, employeeId: true } },
      },
      orderBy: [{ fromDate: "asc" }, { createdAt: "desc" }],
    });
    dayOfWeek = getLocalDayOfWeek(dateOnly, timeZone);

    const teacherIds = approvedLeaves.map((leave) => leave.teacherId);
    if (teacherIds.length > 0) {
      const academicYear = await prisma.academicYear.findFirst({
        where: { schoolId: params.schoolId, isActive: true },
        select: { id: true },
      });

      if (academicYear) {
        const slots = await prisma.timetableSlot.findMany({
          where: {
            academicYearId: academicYear.id,
            dayOfWeek,
            teacherId: { in: teacherIds },
            section: { deletedAt: null, class: { schoolId: params.schoolId, deletedAt: null } },
          },
          select: {
            id: true,
            teacherId: true,
            period: { select: { id: true, periodNumber: true, startTime: true, endTime: true } },
            section: { select: { id: true, sectionName: true, class: { select: { id: true, className: true } } } },
            classSubject: { select: { subject: { select: { id: true, name: true } } } },
          },
          orderBy: [{ period: { periodNumber: "asc" } }],
        });

        const slotsByTeacher = new Map<
          string,
          {
            id: string;
            period: { id: string; periodNumber: number; startTime?: Date | null; endTime?: Date | null };
            class: { id: string; className: string | null };
            section: { id: string; sectionName: string | null };
            subject: { id: string; name: string | null };
          }[]
        >();

        for (const slot of slots) {
          if (!slot.teacherId || !slot.period || !slot.section?.class || !slot.classSubject?.subject) {
            continue;
          }
          const list = slotsByTeacher.get(slot.teacherId) ?? [];
          list.push({
            id: slot.id,
            period: slot.period,
            class: slot.section.class,
            section: slot.section,
            subject: slot.classSubject.subject,
          });
          slotsByTeacher.set(slot.teacherId, list);
        }

        approvedLeaves = approvedLeaves.map((leave) => ({
          ...leave,
          slots: slotsByTeacher.get(leave.teacherId) ?? [],
        }));
      }
    }
  }

  if (params.includeAvailability && dateOnly) {
    const dayOfWeekValue = dayOfWeek ?? getLocalDayOfWeek(dateOnly, timeZone);

    const [periods, teachers, slots, leaves, subs] = await Promise.all([
      prisma.period.findMany({
        where: { schoolId: params.schoolId },
        select: { id: true, periodNumber: true },
        orderBy: { periodNumber: "asc" },
      }),
      prisma.teacher.findMany({
        where: { schoolId: params.schoolId, deletedAt: null },
        select: { id: true, fullName: true },
      }),
      prisma.timetableSlot.findMany({
        where: {
          academicYear: { schoolId: params.schoolId, isActive: true },
          dayOfWeek: dayOfWeekValue,
          teacherId: { not: null },
        },
        select: { teacherId: true, periodId: true },
      }),
      prisma.teacherLeave.findMany({
        where: {
          teacher: { schoolId: params.schoolId, deletedAt: null },
          status: "APPROVED",
          fromDate: { lte: dateOnly },
          toDate: { gte: dateOnly },
        },
        select: { teacherId: true },
      }),
      prisma.substitution.findMany({
        where: { date: dateOnly, class: { schoolId: params.schoolId, deletedAt: null } },
        select: { substituteTeacherId: true, periodId: true },
      }),
    ]);

    const leaveSet = new Set(leaves.map((l) => l.teacherId));
    const slotMap = new Map<string, Set<string>>();
    for (const slot of slots) {
      if (!slot.teacherId) continue;
      const set = slotMap.get(slot.periodId) ?? new Set<string>();
      set.add(slot.teacherId);
      slotMap.set(slot.periodId, set);
    }

    const subMap = new Map<string, Set<string>>();
    for (const sub of subs) {
      if (!sub.substituteTeacherId) continue;
      const set = subMap.get(sub.periodId) ?? new Set<string>();
      set.add(sub.substituteTeacherId);
      subMap.set(sub.periodId, set);
    }

    availability = periods.map((period) => {
      const busy = new Set<string>();
      slotMap.get(period.id)?.forEach((t) => busy.add(t));
      subMap.get(period.id)?.forEach((t) => busy.add(t));
      leaveSet.forEach((t) => busy.add(t));
      const freeTeachers = teachers.filter((t) => !busy.has(t.id));
      return {
        periodId: period.id,
        periodNumber: period.periodNumber,
        freeTeachers,
      };
    });
  }

  return { items, total, availability, approvedLeaves };
}
