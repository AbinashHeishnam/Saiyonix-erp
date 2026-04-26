import { z } from "zod";
import { paginationQuerySchema } from "@/utils/pagination";
export const noteIdSchema = z.string().uuid();
export const noteIdParamSchema = z.object({ id: noteIdSchema }).strict();
export const createNoteSchema = z.object({
    classSubjectId: z.string().uuid(),
    sectionId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1).nullable().optional(),
    fileUrl: z.string().trim().min(1).nullable().optional(),
    fileType: z.string().trim().min(1).nullable().optional(),
    publishedAt: z.coerce.date().optional(),
});
export const updateNoteSchema = z
    .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).nullable().optional(),
    fileUrl: z.string().trim().min(1).nullable().optional(),
    fileType: z.string().trim().min(1).nullable().optional(),
    publishedAt: z.coerce.date().nullable().optional(),
})
    .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
});
export const listNoteQuerySchema = paginationQuerySchema
    .extend({
    classSubjectId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
    studentId: z.string().uuid().optional(),
})
    .strict();
