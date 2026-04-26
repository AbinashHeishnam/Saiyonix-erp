import { z } from "zod";
export const timetableSlotInputSchema = z.object({
    dayOfWeek: z.number().int().min(1).max(7),
    periodId: z.string().uuid(),
    subjectId: z.string().uuid(),
    teacherId: z.string().uuid(),
});
export const bulkCreateTimetableSchema = z.object({
    academicYearId: z.string().uuid(),
    sectionId: z.string().uuid(),
    slots: z.array(timetableSlotInputSchema).min(1),
    effectiveFrom: z.string().min(1),
    overwrite: z.boolean().optional(),
});
export const validateTimetableSlotSchema = z.object({
    academicYearId: z.string().uuid(),
    sectionId: z.string().uuid(),
    dayOfWeek: z.number().int().min(1).max(7),
    periodId: z.string().uuid(),
    subjectId: z.string().uuid(),
    teacherId: z.string().uuid(),
    effectiveFrom: z.string().min(1).optional(),
});
export const deleteTimetableSlotSchema = z.object({
    sectionId: z.string().uuid(),
    dayOfWeek: z.number().int().min(1).max(7),
    periodId: z.string().uuid(),
    effectiveFrom: z.string().min(1).optional(),
});
export const substituteTimetableSchema = z.object({
    timetableSlotId: z.string().uuid(),
    substitutionDate: z.string().min(1),
    substituteTeacherId: z.string().uuid(),
    reason: z.string().trim().min(1).optional(),
});
export const sectionTimetableParamSchema = z.object({
    sectionId: z.string().uuid(),
});
export const timetableDateQuerySchema = z
    .object({
    date: z.string().min(1).optional(),
})
    .strict();
export const teacherTimetableParamSchema = z.object({
    teacherId: z.string().uuid(),
});
export const teacherTimetableQuerySchema = z
    .object({
    academicYearId: z.string().uuid().optional(),
    date: z.string().min(1).optional(),
})
    .strict();
export const timetableMetaParamSchema = z.object({
    sectionId: z.string().uuid(),
});
export const timetableOptionsQuerySchema = z.object({
    classId: z.string().uuid(),
    sectionId: z.string().uuid(),
    academicYearId: z.string().uuid(),
});
