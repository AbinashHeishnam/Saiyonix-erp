import { z } from "zod";

export const classSubjectIdSchema = z.string().uuid();

export const createClassSubjectSchema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  periodsPerWeek: z.number().int().positive(),
});

export const updateClassSubjectSchema = z
  .object({
    classId: z.string().uuid().optional(),
    subjectId: z.string().uuid().optional(),
    periodsPerWeek: z.number().int().positive().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type CreateClassSubjectInput = z.infer<typeof createClassSubjectSchema>;
export type UpdateClassSubjectInput = z.infer<typeof updateClassSubjectSchema>;
