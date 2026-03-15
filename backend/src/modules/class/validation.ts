import { z } from "zod";

export const classIdSchema = z.string().uuid();

export const createClassSchema = z.object({
  className: z.string().trim().min(1),
  classOrder: z.number().int().nonnegative(),
  academicYearId: z.string().uuid(),
  isHalfDay: z.boolean().optional(),
});

export const updateClassSchema = z
  .object({
    className: z.string().trim().min(1).optional(),
    classOrder: z.number().int().nonnegative().optional(),
    academicYearId: z.string().uuid().optional(),
    isHalfDay: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
