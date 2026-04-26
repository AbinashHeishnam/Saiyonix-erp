import { z } from "zod";
export const examIdSchema = z.string().uuid();
export const examIdParamSchema = z.object({ examId: examIdSchema }).strict();
export const reportCardQuerySchema = z
    .object({
    studentId: z.string().uuid().optional(),
    force: z.union([z.literal("true"), z.literal("1"), z.boolean()]).optional(),
})
    .strict();
