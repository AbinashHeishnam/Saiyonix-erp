import { z } from "zod";

export const createOrderSchema = z
  .object({
    amount: z.number().positive().optional(),
    currency: z.string().min(1).optional(),
    receipt: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    studentId: z.string().uuid().optional(),
    academicYearId: z.string().uuid().optional(),
    academicYear: z.string().min(1).optional(),
    classId: z.string().uuid().optional(),
  })
  .refine((data) => Boolean(data.amount) || Boolean(data.studentId), {
    message: "amount or studentId is required",
  });

export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
  studentId: z.string().uuid(),
  amount: z.number().positive(),
  academicYearId: z.string().uuid().optional(),
  errorMessage: z.string().min(1).optional(),
});

export const paymentLogsQuerySchema = z.object({
  studentName: z.string().min(1).optional(),
  studentId: z.string().uuid().optional(),
  status: z.enum(["SUCCESS", "FAILED"]).optional(),
  dateFrom: z.string().min(1).optional(),
  dateTo: z.string().min(1).optional(),
});

export const paymentIdParamSchema = z.object({
  paymentId: z.string().uuid(),
});

export const manualPaymentSchema = z
  .object({
    studentId: z.string().uuid(),
    feeTermId: z.string().uuid(),
    amount: z.number().positive(),
    method: z.enum(["CASH", "ONLINE"]),
    transactionId: z.string().min(1).optional(),
  })
  .refine((data) => data.method !== "ONLINE" || Boolean(data.transactionId), {
    message: "transactionId is required for online payments",
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type PaymentLogsQueryInput = z.infer<typeof paymentLogsQuerySchema>;
export type ManualPaymentInput = z.infer<typeof manualPaymentSchema>;
