import { z } from "zod";
import { attendanceStatusSchema } from "@/modules/attendance/validation";
export const attendanceCorrectionIdSchema = z.string().uuid();
export const attendanceCorrectionIdParamSchema = z
    .object({ id: attendanceCorrectionIdSchema })
    .strict();
export const createCorrectionRequestSchema = z.object({
    attendanceId: z.string().uuid(),
    newStatus: attendanceStatusSchema,
    reason: z.string().trim().min(1),
});
export const reviewCorrectionSchema = z.object({
    remarks: z.string().trim().min(1).optional(),
});
