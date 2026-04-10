import { z } from "zod";

export const academicCalendarEventTypeSchema = z.enum([
  "SESSION_START",
  "SESSION_END",
  "HOLIDAY",
  "TEMPORARY_HOLIDAY",
  "HALF_DAY",
  "EXAM_START",
  "EXAM_END",
  "IMPORTANT_NOTICE",
  "OTHER",
]);

export const academicCalendarEventIdSchema = z.string().uuid();
export const academicCalendarEventIdParamSchema = z
  .object({ id: academicCalendarEventIdSchema })
  .strict();

export const listAcademicCalendarQuerySchema = z
  .object({
    academicYearId: z.string().uuid(),
    from: z.string().optional(),
    to: z.string().optional(),
    eventType: academicCalendarEventTypeSchema.optional(),
  })
  .strict();

export const createAcademicCalendarEventSchema = z
  .object({
    academicYearId: z.string().uuid(),
    title: z.string().trim().min(1),
    description: z.string().trim().optional(),
    eventType: academicCalendarEventTypeSchema,
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    isAllDay: z.boolean().optional(),
    affectsAttendance: z.boolean().optional(),
    affectsClasses: z.boolean().optional(),
    isTemporaryTodayOnly: z.boolean().optional(),
    notifyUsers: z.boolean().optional(),
    color: z.string().trim().optional(),
  })
  .strict();

export const updateAcademicCalendarEventSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    eventType: academicCalendarEventTypeSchema.optional(),
    startDate: z.string().min(1).optional(),
    endDate: z.string().min(1).optional(),
    isAllDay: z.boolean().optional(),
    affectsAttendance: z.boolean().optional(),
    affectsClasses: z.boolean().optional(),
    isTemporaryTodayOnly: z.boolean().optional(),
    notifyUsers: z.boolean().optional(),
    color: z.string().trim().optional(),
  })
  .strict();

export const emergencyHolidaySchema = z
  .object({
    academicYearId: z.string().uuid(),
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    notifyUsers: z.boolean().optional(),
  })
  .strict();

export type CreateAcademicCalendarEventInput = z.infer<
  typeof createAcademicCalendarEventSchema
>;
export type UpdateAcademicCalendarEventInput = z.infer<
  typeof updateAcademicCalendarEventSchema
>;
export type EmergencyHolidayInput = z.infer<typeof emergencyHolidaySchema>;
