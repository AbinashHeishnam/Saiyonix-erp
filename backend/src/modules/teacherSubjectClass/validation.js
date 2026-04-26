import { z } from "zod";
import { paginationQuerySchema } from "@/utils/pagination";
export const teacherSubjectClassIdSchema = z.string().uuid();
export const teacherSubjectClassIdParamSchema = z
    .object({ id: teacherSubjectClassIdSchema })
    .strict();
export const createTeacherSubjectClassSchema = z.object({
    teacherId: z.string().uuid(),
    classSubjectId: z.string().uuid(),
    sectionId: z.string().uuid().optional(),
    academicYearId: z.string().uuid(),
});
export const updateTeacherSubjectClassSchema = z
    .object({
    teacherId: z.string().uuid().optional(),
    classSubjectId: z.string().uuid().optional(),
    sectionId: z.string().uuid().nullable().optional(),
    academicYearId: z.string().uuid().optional(),
})
    .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
});
export const listTeacherSubjectClassQuerySchema = paginationQuerySchema
    .extend({
    teacherId: z.string().uuid().optional(),
    classId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
    academicYearId: z.string().uuid().optional(),
})
    .strict();
