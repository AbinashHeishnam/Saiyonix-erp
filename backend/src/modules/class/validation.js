import { z } from "zod";
import { paginationQuerySchema } from "@/utils/pagination";
export const classIdSchema = z.string().uuid();
export const classIdParamSchema = z.object({ id: classIdSchema }).strict();
export const listClassQuerySchema = paginationQuerySchema.extend({
    academicYearId: z.string().uuid().optional(),
});
export const createClassSchema = z.object({
    className: z.string().trim().min(1),
    classOrder: z.number().int().nonnegative(),
    academicYearId: z.string().uuid(),
    isHalfDay: z.boolean().optional(),
    totalSections: z.number().int().min(1).max(26),
    capacity: z.number().int().min(1),
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
export const assignClassTeacherSchema = z.object({
    classId: classIdSchema,
    teacherId: z.string().uuid(),
});
export const removeClassTeacherSchema = z.object({
    classId: classIdSchema,
});
