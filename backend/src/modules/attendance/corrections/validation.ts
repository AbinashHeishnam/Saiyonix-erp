import { z } from "zod";

import { attendanceStatusSchema } from "../validation";

export const attendanceCorrectionIdSchema = z.string().uuid();

export const createCorrectionRequestSchema = z.object({
  attendanceId: z.string().uuid(),
  newStatus: attendanceStatusSchema,
  reason: z.string().trim().min(1),
});

export const reviewCorrectionSchema = z.object({
  remarks: z.string().trim().min(1).optional(),
});

export type CreateCorrectionRequestInput = z.infer<
  typeof createCorrectionRequestSchema
>;
export type ReviewCorrectionInput = z.infer<typeof reviewCorrectionSchema>;
