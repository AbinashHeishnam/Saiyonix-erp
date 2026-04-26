import { z } from "zod";
export const certificateRequestIdSchema = z.string().uuid();
export const certificateRequestIdParamSchema = z
    .object({ id: certificateRequestIdSchema })
    .strict();
export const certificateTypeSchema = z.enum(["TC", "CHARACTER", "REGISTRATION"]);
export const requestStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const createCertificateRequestSchema = z
    .object({
    type: certificateTypeSchema,
    reason: z.string().trim().min(1).optional(),
    studentId: z.string().uuid().optional(),
})
    .strict();
export const adminApproveCertificateSchema = z
    .object({
    requestId: certificateRequestIdSchema,
})
    .strict();
export const adminRejectCertificateSchema = z
    .object({
    requestId: certificateRequestIdSchema,
    rejectedReason: z.string().trim().min(1),
})
    .strict();
export const adminGenerateTcSchema = z
    .object({
    studentId: z.string().uuid(),
    reason: z.string().trim().min(1),
    date: z.coerce.date().optional(),
    expel: z.boolean().optional(),
})
    .strict();
