import { z } from "zod";
import { paginationQuerySchema } from "@/utils/pagination";
export const assignmentIdSchema = z.string().uuid();
export const submissionIdSchema = z.string().uuid();
export const assignmentIdParamSchema = z.object({ id: assignmentIdSchema }).strict();
export const submissionIdParamSchema = z.object({ id: submissionIdSchema }).strict();
export const createAssignmentSchema = z.object({
    classSubjectId: z.string().uuid(),
    sectionId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1).nullable().optional(),
    dueAt: z.coerce.date(),
    maxMarks: z.coerce.number().min(0).nullable().optional(),
});
export const updateAssignmentSchema = z
    .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).nullable().optional(),
    dueAt: z.coerce.date().optional(),
    maxMarks: z.coerce.number().min(0).nullable().optional(),
})
    .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
});
export const submitAssignmentSchema = z.object({
    submissionUrl: z.string().trim().min(1),
});
export const gradeSubmissionSchema = z
    .object({
    marksAwarded: z.coerce.number().min(0).nullable().optional(),
    teacherRemarks: z.string().trim().min(1).nullable().optional(),
})
    .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
});
export const addAttachmentSchema = z
    .object({
    fileName: z.string().trim().min(1),
    fileUrl: z.string().trim().min(1),
    fileKey: z.string().trim().min(1).optional(),
})
    .strict();
export const listAssignmentQuerySchema = paginationQuerySchema
    .extend({
    classSubjectId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
})
    .strict();
export const listAssignmentSubmissionsQuerySchema = paginationQuerySchema;
