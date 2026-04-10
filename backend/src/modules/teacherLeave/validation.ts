import { z } from "zod";

import { paginationQuerySchema } from "@/utils/pagination";

export const teacherLeaveIdSchema = z.string().uuid();
export const teacherLeaveIdParamSchema = z.object({ id: teacherLeaveIdSchema }).strict();
export const listTeacherLeaveQuerySchema = paginationQuerySchema;

export const createTeacherLeaveSchema = z
  .object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().trim().min(1).max(500),
    leaveType: z.enum(["SICK", "CASUAL", "EMERGENCY", "OTHER"]).optional(),
    attachmentUrl: z.string().trim().min(1).optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const applyTeacherLeaveSchema = z
  .object({
    fromDate: z.coerce.date(),
    toDate: z.coerce.date(),
    reason: z.string().trim().min(1).max(500),
    leaveType: z.enum(["SICK", "CASUAL", "EMERGENCY", "OTHER"]).optional(),
    attachmentUrl: z.string().trim().min(1).optional(),
  })
  .refine((data) => data.toDate >= data.fromDate, {
    message: "toDate must be on or after fromDate",
    path: ["toDate"],
  });

export const adminUpdateTeacherLeaveSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  remarks: z.string().trim().max(500).optional(),
});

export type CreateTeacherLeaveInput = z.infer<typeof createTeacherLeaveSchema>;
export type ApplyTeacherLeaveInput = z.infer<typeof applyTeacherLeaveSchema>;
