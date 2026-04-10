import { Prisma } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { buildDateRange, normalizeDate } from "@/core/utils/date";
import { toLocalDateOnly } from "@/core/utils/localDate";
import { trigger as triggerNotification } from "@/modules/notification/service";
import type {
  CreateAcademicCalendarEventInput,
  EmergencyHolidayInput,
  UpdateAcademicCalendarEventInput,
} from "@/modules/academicCalendar/validation";

const HOLIDAY_TYPES = new Set(["HOLIDAY", "TEMPORARY_HOLIDAY"]);

const prismaClient = prisma;

type DbClient = typeof prisma;

type CalendarDateRange = {
  startDate: Date;
  endDate: Date;
};

async function ensureAcademicYearBelongsToSchool(
  client: DbClient,
  schoolId: string,
  academicYearId: string
) {
  const record = await client.academicYear.findFirst({
    where: { id: academicYearId, schoolId },
    select: { id: true },
  });
  if (!record) {
    throw new ApiError(400, "Academic year not found for this school");
  }
}

async function getSchoolTimeZone(client: DbClient, schoolId: string) {
  const school = await client.school.findUnique({
    where: { id: schoolId },
    select: { timezone: true },
  });
  return school?.timezone ?? "Asia/Kolkata";
}

function parseDateInput(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "Invalid date format");
  }
  return toLocalDateOnly(date, timeZone);
}

async function resolveDateRange(
  client: DbClient,
  schoolId: string,
  input: { startDate: string; endDate: string; isTemporaryTodayOnly?: boolean }
): Promise<CalendarDateRange> {
  const timeZone = await getSchoolTimeZone(client, schoolId);
  if (input.isTemporaryTodayOnly) {
    const today = toLocalDateOnly(new Date(), timeZone);
    return { startDate: today, endDate: today };
  }
  const startDate = parseDateInput(input.startDate, timeZone);
  const endDate = parseDateInput(input.endDate, timeZone);
  if (endDate < startDate) {
    throw new ApiError(400, "endDate must be on or after startDate");
  }
  return { startDate, endDate };
}

async function syncHolidayEntries(
  client: DbClient,
  params: {
    calendarEventId: string;
    schoolId: string;
    academicYearId: string;
    title: string;
    description?: string | null;
    startDate: Date;
    endDate: Date;
    isHalfDay: boolean;
    affectsAttendance: boolean;
  }
) {
  await client.holiday.deleteMany({
    where: { calendarEventId: params.calendarEventId },
  });

  if (!params.affectsAttendance) return;

  const dates = buildDateRange(params.startDate, params.endDate);
  for (const date of dates) {
    await client.holiday.upsert({
      where: {
        schoolId_holidayDate_title: {
          schoolId: params.schoolId,
          holidayDate: date,
          title: params.title,
        },
      },
      update: {
        description: params.description ?? null,
        isHalfDay: params.isHalfDay,
        calendarEventId: params.calendarEventId,
        academicYearId: params.academicYearId,
      },
      create: {
        schoolId: params.schoolId,
        academicYearId: params.academicYearId,
        calendarEventId: params.calendarEventId,
        holidayDate: date,
        title: params.title,
        description: params.description ?? null,
        isHalfDay: params.isHalfDay,
      },
    });
  }
}

function buildNotificationMessage(event: {
  title: string;
  eventType: string;
  startDate: Date;
  endDate: Date;
  isTemporaryTodayOnly: boolean;
}) {
  const startLabel = event.startDate.toISOString().slice(0, 10);
  const endLabel = event.endDate.toISOString().slice(0, 10);
  const range = startLabel === endLabel ? startLabel : `${startLabel} to ${endLabel}`;
  const prefix = event.isTemporaryTodayOnly ? "Temporary" : "Academic";
  return `${prefix} ${event.eventType.replace(/_/g, " ").toLowerCase()} announced: ${event.title} (${range}).`;
}

async function maybeNotifyEvent(params: {
  schoolId: string;
  eventId: string;
  eventType: string;
  title: string;
  startDate: Date;
  endDate: Date;
  isTemporaryTodayOnly: boolean;
  notifyUsers: boolean;
  sentById?: string;
}) {
  if (!params.notifyUsers) return;
  const message = buildNotificationMessage(params);
  await triggerNotification("SCHOOL_BROADCAST", {
    schoolId: params.schoolId,
    sentById: params.sentById,
    title: "Academic Calendar Update",
    body: message,
    entityType: "ACADEMIC_CALENDAR",
    entityId: params.eventId,
    metadata: {
      eventType: params.eventType,
      title: params.title,
      startDate: params.startDate,
      endDate: params.endDate,
    },
  });
}

export async function listAcademicCalendarEvents(params: {
  schoolId: string;
  academicYearId: string;
  from?: string;
  to?: string;
  eventType?: string;
}) {
  await ensureAcademicYearBelongsToSchool(prismaClient, params.schoolId, params.academicYearId);

  const where: Prisma.AcademicCalendarEventWhereInput = {
    schoolId: params.schoolId,
    academicYearId: params.academicYearId,
  };

  if (params.eventType) {
    where.eventType = params.eventType as Prisma.AcademicCalendarEventWhereInput["eventType"];
  }

  if (params.from || params.to) {
    const fromDate = params.from ? normalizeDate(new Date(params.from)) : null;
    const toDate = params.to ? normalizeDate(new Date(params.to)) : null;
    if (fromDate && Number.isNaN(fromDate.getTime())) {
      throw new ApiError(400, "Invalid from date");
    }
    if (toDate && Number.isNaN(toDate.getTime())) {
      throw new ApiError(400, "Invalid to date");
    }
    if (fromDate && toDate && toDate < fromDate) {
      throw new ApiError(400, "to must be on or after from");
    }
    if (fromDate && toDate) {
      where.OR = [
        { startDate: { lte: toDate }, endDate: { gte: fromDate } },
      ];
    } else if (fromDate) {
      where.endDate = { gte: fromDate };
    } else if (toDate) {
      where.startDate = { lte: toDate };
    }
  }

  const items = await prismaClient.academicCalendarEvent.findMany({
    where,
    orderBy: [{ startDate: "asc" }, { endDate: "asc" }],
  });

  return { items, total: items.length };
}

export async function getAcademicCalendarSummary(params: {
  schoolId: string;
  academicYearId: string;
}) {
  await ensureAcademicYearBelongsToSchool(prismaClient, params.schoolId, params.academicYearId);
  const events = await prismaClient.academicCalendarEvent.findMany({
    where: { schoolId: params.schoolId, academicYearId: params.academicYearId },
    orderBy: { startDate: "asc" },
  });

  const sessionStart = events.find((event) => event.eventType === "SESSION_START")?.startDate ?? null;
  const sessionEnd = events.find((event) => event.eventType === "SESSION_END")?.endDate ?? null;

  return {
    sessionStart,
    sessionEnd,
    totalEvents: events.length,
    holidayCount: events.filter((event) => HOLIDAY_TYPES.has(event.eventType)).length,
  };
}

export async function createAcademicCalendarEvent(
  schoolId: string,
  payload: CreateAcademicCalendarEventInput,
  actorUserId?: string
) {
  return prisma.$transaction(async (tx) => {
    const db = tx as DbClient;
    await ensureAcademicYearBelongsToSchool(db, schoolId, payload.academicYearId);
    const range = await resolveDateRange(db, schoolId, payload);

    const created = await tx.academicCalendarEvent.create({
      data: {
        schoolId,
        academicYearId: payload.academicYearId,
        title: payload.title,
        description: payload.description ?? null,
        eventType: payload.eventType,
        startDate: range.startDate,
        endDate: range.endDate,
        isAllDay: payload.isAllDay ?? true,
        affectsAttendance: payload.affectsAttendance ?? false,
        affectsClasses: payload.affectsClasses ?? false,
        isTemporaryTodayOnly: payload.isTemporaryTodayOnly ?? false,
        notifyUsers: payload.notifyUsers ?? false,
        color: payload.color ?? null,
      },
    });

    if (payload.eventType === "SESSION_START") {
      await tx.academicYear.update({
        where: { id: payload.academicYearId },
        data: { startDate: range.startDate },
      });
    }

    if (payload.eventType === "SESSION_END") {
      await tx.academicYear.update({
        where: { id: payload.academicYearId },
        data: { endDate: range.endDate },
      });
    }

    if (
      payload.eventType === "HOLIDAY" ||
      payload.eventType === "TEMPORARY_HOLIDAY" ||
      payload.eventType === "HALF_DAY"
    ) {
      await syncHolidayEntries(db, {
        calendarEventId: created.id,
        schoolId,
        academicYearId: payload.academicYearId,
        title: payload.title,
        description: payload.description ?? null,
        startDate: range.startDate,
        endDate: range.endDate,
        isHalfDay: payload.eventType === "HALF_DAY",
        affectsAttendance: payload.affectsAttendance ?? true,
      });
    }

    await maybeNotifyEvent({
      schoolId,
      eventId: created.id,
      eventType: created.eventType,
      title: created.title,
      startDate: created.startDate,
      endDate: created.endDate,
      isTemporaryTodayOnly: created.isTemporaryTodayOnly,
      notifyUsers: created.notifyUsers,
      sentById: actorUserId,
    });

    return created;
  });
}

export async function updateAcademicCalendarEvent(
  schoolId: string,
  eventId: string,
  payload: UpdateAcademicCalendarEventInput,
  actorUserId?: string
) {
  return prisma.$transaction(async (tx) => {
    const db = tx as DbClient;
    const existing = await tx.academicCalendarEvent.findFirst({
      where: { id: eventId, schoolId },
    });
    if (!existing) {
      throw new ApiError(404, "Academic calendar event not found");
    }

    const range = await resolveDateRange(db, schoolId, {
      startDate: payload.startDate ?? existing.startDate.toISOString(),
      endDate: payload.endDate ?? existing.endDate.toISOString(),
      isTemporaryTodayOnly: payload.isTemporaryTodayOnly ?? existing.isTemporaryTodayOnly,
    });

    const updated = await tx.academicCalendarEvent.update({
      where: { id: existing.id },
      data: {
        title: payload.title ?? existing.title,
        description: payload.description ?? existing.description,
        eventType: payload.eventType ?? existing.eventType,
        startDate: range.startDate,
        endDate: range.endDate,
        isAllDay: payload.isAllDay ?? existing.isAllDay,
        affectsAttendance: payload.affectsAttendance ?? existing.affectsAttendance,
        affectsClasses: payload.affectsClasses ?? existing.affectsClasses,
        isTemporaryTodayOnly: payload.isTemporaryTodayOnly ?? existing.isTemporaryTodayOnly,
        notifyUsers: payload.notifyUsers ?? existing.notifyUsers,
        color: payload.color ?? existing.color,
      },
    });

    if (updated.eventType === "SESSION_START") {
      await tx.academicYear.update({
        where: { id: updated.academicYearId },
        data: { startDate: updated.startDate },
      });
    }

    if (updated.eventType === "SESSION_END") {
      await tx.academicYear.update({
        where: { id: updated.academicYearId },
        data: { endDate: updated.endDate },
      });
    }

    if (
      updated.eventType === "HOLIDAY" ||
      updated.eventType === "TEMPORARY_HOLIDAY" ||
      updated.eventType === "HALF_DAY"
    ) {
      await syncHolidayEntries(db, {
        calendarEventId: updated.id,
        schoolId,
        academicYearId: updated.academicYearId,
        title: updated.title,
        description: updated.description ?? null,
        startDate: updated.startDate,
        endDate: updated.endDate,
        isHalfDay: updated.eventType === "HALF_DAY",
        affectsAttendance: updated.affectsAttendance,
      });
    } else {
      await tx.holiday.deleteMany({ where: { calendarEventId: updated.id } });
    }

    await maybeNotifyEvent({
      schoolId,
      eventId: updated.id,
      eventType: updated.eventType,
      title: updated.title,
      startDate: updated.startDate,
      endDate: updated.endDate,
      isTemporaryTodayOnly: updated.isTemporaryTodayOnly,
      notifyUsers: updated.notifyUsers,
      sentById: actorUserId,
    });

    return updated;
  });
}

export async function deleteAcademicCalendarEvent(
  schoolId: string,
  eventId: string
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.academicCalendarEvent.findFirst({
      where: { id: eventId, schoolId },
    });
    if (!existing) {
      throw new ApiError(404, "Academic calendar event not found");
    }

    await tx.holiday.deleteMany({ where: { calendarEventId: existing.id } });
    await tx.academicCalendarEvent.delete({ where: { id: existing.id } });

    return { id: existing.id };
  });
}

export async function createEmergencyHoliday(
  schoolId: string,
  payload: EmergencyHolidayInput,
  actorUserId?: string
) {
  const title = payload.title?.trim() || "Emergency Holiday";
  return createAcademicCalendarEvent(
    schoolId,
    {
      academicYearId: payload.academicYearId,
      title,
      description: payload.description,
      eventType: "TEMPORARY_HOLIDAY",
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      isAllDay: true,
      affectsAttendance: true,
      affectsClasses: true,
      isTemporaryTodayOnly: true,
      notifyUsers: payload.notifyUsers ?? true,
    },
    actorUserId
  );
}

export async function getSessionStartDate(
  client: DbClient | undefined,
  academicYearId: string
): Promise<Date | null> {
  const db = client ?? prismaClient;
  const event = await db.academicCalendarEvent.findFirst({
    where: { academicYearId, eventType: "SESSION_START" },
    orderBy: { startDate: "desc" },
    select: { startDate: true },
  });
  if (event?.startDate) return event.startDate;
  const year = await db.academicYear.findFirst({
    where: { id: academicYearId },
    select: { startDate: true },
  });
  return year?.startDate ?? null;
}

export async function getSessionEndDate(
  client: DbClient | undefined,
  academicYearId: string
): Promise<Date | null> {
  const db = client ?? prismaClient;
  const event = await db.academicCalendarEvent.findFirst({
    where: { academicYearId, eventType: "SESSION_END" },
    orderBy: { endDate: "desc" },
    select: { endDate: true },
  });
  if (event?.endDate) return event.endDate;
  const year = await db.academicYear.findFirst({
    where: { id: academicYearId },
    select: { endDate: true },
  });
  return year?.endDate ?? null;
}

export async function getAttendanceBlockedDates(params: {
  academicYearId: string;
  from: Date;
  to: Date;
}) {
  const events = await prismaClient.academicCalendarEvent.findMany({
    where: {
      academicYearId: params.academicYearId,
      affectsAttendance: true,
      eventType: { in: ["HOLIDAY", "TEMPORARY_HOLIDAY"] },
      startDate: { lte: params.to },
      endDate: { gte: params.from },
    },
    select: { startDate: true, endDate: true },
  });

  const blocked = new Set<string>();
  for (const event of events) {
    const dates = buildDateRange(event.startDate, event.endDate);
    for (const date of dates) {
      blocked.add(normalizeDate(date).toISOString());
    }
  }
  return blocked;
}

export async function assertAttendanceAllowed(params: {
  schoolId: string;
  academicYearId: string;
  attendanceDate: Date;
}) {
  const sessionStart = await getSessionStartDate(prisma, params.academicYearId);
  if (sessionStart && params.attendanceDate < sessionStart) {
    throw new ApiError(403, "Attendance not active before session start");
  }

  const blocked = await getAttendanceBlockedDates({
    academicYearId: params.academicYearId,
    from: params.attendanceDate,
    to: params.attendanceDate,
  });

  if (blocked.has(normalizeDate(params.attendanceDate).toISOString())) {
    throw new ApiError(403, "Attendance disabled due to holiday");
  }
}

export async function isAttendanceAllowed(params: {
  academicYearId: string;
  attendanceDate: Date;
}) {
  const sessionStart = await getSessionStartDate(prisma, params.academicYearId);
  if (sessionStart && params.attendanceDate < sessionStart) {
    return { allowed: false, reason: "Attendance not active before session start" };
  }

  const blocked = await getAttendanceBlockedDates({
    academicYearId: params.academicYearId,
    from: params.attendanceDate,
    to: params.attendanceDate,
  });

  if (blocked.has(normalizeDate(params.attendanceDate).toISOString())) {
    return { allowed: false, reason: "Attendance disabled due to holiday" };
  }

  return { allowed: true };
}
