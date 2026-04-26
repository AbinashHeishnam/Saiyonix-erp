import { z } from "zod";
export const promotionCriteriaSchema = z
    .object({
    academicYearId: z.string().uuid(),
    minAttendancePercent: z.coerce.number().min(0).max(100),
    minSubjectPassCount: z.coerce.number().int().min(0),
    allowUnderConsideration: z.boolean().optional(),
})
    .strict();
export const generatePromotionSchema = z
    .object({
    academicYearId: z.string().uuid(),
    examId: z.string().uuid(),
})
    .strict();
export const listPromotionSchema = z
    .object({
    academicYearId: z.string().uuid(),
    status: z.enum(["ELIGIBLE", "UNDER_CONSIDERATION", "FAILED"]).optional(),
    classId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
})
    .strict();
export const overridePromotionSchema = z
    .object({
    promotionRecordId: z.string().cuid(),
})
    .strict();
export const reviewPromotionOverrideSchema = z
    .object({
    promotionRecordId: z.string().cuid(),
    action: z.enum(["APPROVE", "REJECT", "REVERT"]),
})
    .strict();
export const publishPromotionSchema = z
    .object({
    fromAcademicYearId: z.string().uuid(),
    toAcademicYearId: z.string().uuid(),
    promoteBy: z.enum(["RANK", "PERCENTAGE"]),
    activateNewYear: z.boolean().optional(),
    resetOperationalData: z.boolean().optional(),
})
    .strict();
export const applyFinalPromotionSchema = publishPromotionSchema;
export const previewPromotionSchema = z
    .object({
    fromAcademicYearId: z.string().uuid(),
})
    .strict();
export const promotionTransitionSchema = z
    .object({
    fromAcademicYearId: z.string().uuid(),
    toAcademicYearId: z.string().uuid(),
})
    .strict();
export const assignRollNumbersSchema = z
    .object({
    academicYearId: z.string().uuid(),
})
    .strict();
