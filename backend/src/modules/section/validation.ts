import { z } from "zod";

import { paginationQuerySchema } from "@/utils/pagination";

export const sectionIdSchema = z.string().uuid();
export const sectionIdParamSchema = z.object({ id: sectionIdSchema }).strict();
export const listSectionQuerySchema = paginationQuerySchema.extend({
  academicYearId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
});

export const createSectionSchema = z.object({
  classId: z.string().uuid(),
  sectionName: z.string().trim().min(1),
  capacity: z.number().int().positive().optional(),
  classTeacherId: z.string().uuid().optional(),
});

export const updateSectionSchema = z
  .object({
    classId: z.string().uuid().optional(),
    sectionName: z.string().trim().min(1).optional(),
    capacity: z.number().int().positive().optional(),
    classTeacherId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
