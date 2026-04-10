import { z } from "zod";

import { paginationQuerySchema } from "@/utils/pagination";

export const timetableSlotIdSchema = z.string().uuid();
export const timetableSlotIdParamSchema = z.object({ id: timetableSlotIdSchema }).strict();
export const listTimetableSlotQuerySchema = paginationQuerySchema;

export const createTimetableSlotSchema = z.object({
  sectionId: z.string().uuid(),
  classSubjectId: z.string().uuid(),
  teacherId: z.string().uuid().nullable().optional(),
  academicYearId: z.string().uuid(),
  dayOfWeek: z.number().int().min(1).max(7),
  periodId: z.string().uuid(),
  effectiveFrom: z.string().min(1),
  roomNo: z.string().trim().min(1).optional(),
});

export const updateTimetableSlotSchema = z
  .object({
    sectionId: z.string().uuid().optional(),
    classSubjectId: z.string().uuid().optional(),
    teacherId: z.string().uuid().nullable().optional(),
    academicYearId: z.string().uuid().optional(),
    dayOfWeek: z.number().int().min(1).max(7).optional(),
    periodId: z.string().uuid().optional(),
    effectiveFrom: z.string().min(1).optional(),
    roomNo: z.string().trim().min(1).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type CreateTimetableSlotInput = z.infer<typeof createTimetableSlotSchema>;
export type UpdateTimetableSlotInput = z.infer<typeof updateTimetableSlotSchema>;
