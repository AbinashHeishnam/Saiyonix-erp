import { z } from "zod";
export const examIdSchema = z.string().uuid();
export const examIdParamSchema = z.object({ examId: examIdSchema }).strict();
export const resultsQuerySchema = z
    .object({
    studentId: z.string().uuid().optional(),
})
    .strict();
