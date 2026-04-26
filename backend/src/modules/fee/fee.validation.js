import { z } from "zod";
export const createFeeStructureSchema = z.object({
    classId: z.string().uuid(),
    amount: z.number().positive(),
    academicYearId: z.string().uuid().optional(),
    academicYear: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
});
export const payFeeSchema = z.object({
    studentId: z.string().uuid().optional(),
    amount: z.number().positive(),
    academicYearId: z.string().uuid().optional(),
    academicYear: z.string().min(1).optional(),
    classId: z.string().uuid().optional(),
    payment: z
        .object({
        orderId: z.string().min(1),
        paymentId: z.string().min(1),
        signature: z.string().min(1),
    })
        .optional(),
});
export const studentFeeParamsSchema = z.object({
    id: z.string().uuid(),
});
export const publishFeeSchema = z.object({
    classId: z.string().uuid(),
    academicYearId: z.string().uuid().optional(),
    academicYear: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
});
export const listFeeStructuresSchema = z.object({
    academicYearId: z.string().uuid().optional(),
    classId: z.string().uuid().optional(),
    category: z.string().min(1).optional(),
    isPublished: z
        .string()
        .transform((value) => value.toLowerCase())
        .refine((value) => value === "true" || value === "false", "Invalid boolean")
        .optional(),
});
export const scholarshipSchema = z
    .object({
    title: z.string().min(1).optional(),
    discountPercent: z.number().min(0).max(100),
    classId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
    admissionNumber: z.string().min(1).optional(),
    academicYearId: z.string().uuid().optional(),
    academicYear: z.string().min(1).optional(),
})
    .refine((data) => !data.sectionId || Boolean(data.classId), { message: "classId is required when sectionId is provided" });
export const discountSchema = z.object({
    studentId: z.string().uuid().optional(),
    classId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
    amount: z.number().positive(),
    isPercent: z.boolean().optional(),
    academicYearId: z.string().uuid().optional(),
    academicYear: z.string().min(1).optional(),
})
    .refine((data) => Boolean(data.studentId || data.classId || data.sectionId), { message: "studentId, classId, or sectionId is required" })
    .refine((data) => !data.sectionId || Boolean(data.classId), { message: "classId is required when sectionId is provided" });
export const feeDeadlineSchema = z.object({
    dueDate: z.string().min(1),
    lateFeePercent: z.number().min(0).optional(),
    classId: z.string().uuid().optional(),
    academicYearId: z.string().uuid().optional(),
    academicYear: z.string().min(1).optional(),
});
export const feeRecordsQuerySchema = z.object({
    academicYearId: z.string().uuid().optional(),
    classId: z.string().uuid().optional(),
});
export const feeReceiptsQuerySchema = z.object({
    studentId: z.string().uuid().optional(),
});
export const feeReceiptParamsSchema = z.object({
    paymentId: z.string().uuid(),
});
export const feeOverviewQuerySchema = z.object({
    academicYearId: z.string().uuid().optional(),
});
export const scholarshipIdParamSchema = z.object({
    id: z.string().cuid(),
});
export const discountIdParamSchema = z.object({
    id: z.string().uuid(),
});
