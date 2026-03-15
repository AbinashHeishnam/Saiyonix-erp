import { z } from "zod";

export const subjectIdSchema = z.string().uuid();

export const createSubjectSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  isElective: z.boolean().optional(),
});

export const updateSubjectSchema = z
  .object({
    code: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    isElective: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
