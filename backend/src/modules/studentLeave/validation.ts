import { z } from "zod";

import { paginationQuerySchema } from "@/utils/pagination";

export const studentLeaveIdSchema = z.string().uuid();
export const studentLeaveIdParamSchema = z.object({ id: studentLeaveIdSchema }).strict();
export const listStudentLeaveQuerySchema = paginationQuerySchema;

export const createStudentLeaveSchema = z
  .object({
    studentId: z.string().uuid().optional(),
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

export const applyStudentLeaveSchema = z
  .object({
    studentId: z.string().uuid().optional(),
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

export const adminUpdateStudentLeaveSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  remarks: z.string().trim().max(500).optional(),
});

export type CreateStudentLeaveInput = z.infer<typeof createStudentLeaveSchema>;
export type ApplyStudentLeaveInput = z.infer<typeof applyStudentLeaveSchema>;
