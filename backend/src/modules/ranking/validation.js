import { z } from "zod";
import { paginationQuerySchema } from "@/utils/pagination";
export const examIdSchema = z.string().uuid();
export const examIdParamSchema = z.object({ examId: examIdSchema }).strict();
export const classIdSchema = z.string().uuid();
export const classRankingParamSchema = z
    .object({ examId: examIdSchema, classId: classIdSchema })
    .strict();
export const rankingQuerySchema = paginationQuerySchema;
