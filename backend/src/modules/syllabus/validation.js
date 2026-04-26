import { z } from "zod";
export const syllabusIdSchema = z.string().uuid();
export const syllabusTopicIdSchema = z.string().uuid();
export const syllabusIdParamSchema = z.object({ id: syllabusIdSchema }).strict();
export const syllabusTopicIdParamSchema = z.object({ id: syllabusTopicIdSchema }).strict();
export const createSyllabusSchema = z.object({
    classSubjectId: z.string().uuid(),
    academicYearId: z.string().uuid(),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1).nullable().optional(),
});
export const createTopicSchema = z
    .object({
    title: z.string().trim().min(1),
    sequenceNo: z.coerce.number().int().positive(),
})
    .strict();
const updateTopicBaseSchema = z
    .object({
    title: z.string().trim().min(1).optional(),
    sequenceNo: z.coerce.number().int().positive().optional(),
})
    .strict();
export const updateTopicSchema = updateTopicBaseSchema.refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
});
export const listSyllabusQuerySchema = z
    .object({
    classSubjectId: z.string().uuid(),
})
    .strict();
