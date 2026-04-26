import { z } from "zod";
export const classSubjectConfigQuerySchema = z.object({
    classId: z.string().uuid(),
});
export const upsertClassSubjectConfigSchema = z.object({
    classId: z.string().uuid(),
    subjectIds: z.array(z.string().uuid()),
});
export const copyClassSubjectConfigSchema = z.object({
    targetAcademicYearId: z.string().uuid(),
});
