import { z } from "zod";
import { paginationQuerySchema } from "@/utils/pagination";
export const circularIdSchema = z.string().cuid();
export const circularIdParamSchema = z.object({ id: circularIdSchema }).strict();
const targetTypeSchema = z.enum(["ALL", "CLASS", "SECTION", "ROLE"]);
const targetRoleSchema = z.enum([
    "SUPER_ADMIN",
    "ADMIN",
    "ACADEMIC_SUB_ADMIN",
    "FINANCE_SUB_ADMIN",
    "TEACHER",
    "PARENT",
    "STUDENT",
]);
const baseCircularSchema = z.object({
    title: z.string().trim().min(1),
    body: z.string().trim().min(1),
    attachments: z.unknown().optional(),
    targetType: targetTypeSchema,
    targetClassId: z.string().uuid().nullable().optional(),
    targetSectionId: z.string().uuid().nullable().optional(),
    targetRole: targetRoleSchema.nullable().optional(),
    publishedAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
});
function isEmpty(value) {
    return value === undefined || value === null;
}
function validateTargeting(data) {
    const hasClass = !isEmpty(data.targetClassId);
    const hasSection = !isEmpty(data.targetSectionId);
    const hasRole = !isEmpty(data.targetRole);
    if (!data.targetType) {
        return !hasClass && !hasSection && !hasRole;
    }
    if (data.targetType === "ALL") {
        return !hasClass && !hasSection && !hasRole;
    }
    if (data.targetType === "CLASS") {
        return hasClass && !hasSection && !hasRole;
    }
    if (data.targetType === "SECTION") {
        return hasSection && !hasClass && !hasRole;
    }
    if (data.targetType === "ROLE") {
        return hasRole && !hasClass && !hasSection;
    }
    return false;
}
export const createCircularSchema = baseCircularSchema.refine(validateTargeting, {
    message: "Invalid targeting configuration",
    path: ["targetType"],
});
export const updateCircularSchema = baseCircularSchema
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
})
    .refine(validateTargeting, {
    message: "Invalid targeting configuration",
    path: ["targetType"],
});
export const listCircularQuerySchema = paginationQuerySchema
    .extend({
    classId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
    roleType: targetRoleSchema.optional(),
})
    .strict();
