import { z } from "zod";
import { paginationQuerySchema } from "@/utils/pagination";
export const noticeIdSchema = z.string().uuid();
export const noticeIdParamSchema = z.object({ id: noticeIdSchema }).strict();
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
export const createNoticeSchema = z.object({
    title: z.string().trim().min(1),
    content: z.string().trim().min(1),
    noticeType: z.string().trim().min(1),
    isPublic: z.boolean().optional(),
    targetType: targetTypeSchema.optional(),
    targetClassId: z.string().uuid().nullable().optional(),
    targetSectionId: z.string().uuid().nullable().optional(),
    targetRole: targetRoleSchema.nullable().optional(),
    publishedAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
    attachments: z.array(z.string().trim().min(1)).optional(),
}).refine(validateTargeting, {
    message: "Invalid targeting configuration",
    path: ["targetType"],
});
export const updateNoticeSchema = z
    .object({
    title: z.string().trim().min(1).optional(),
    content: z.string().trim().min(1).optional(),
    noticeType: z.string().trim().min(1).optional(),
    isPublic: z.boolean().optional(),
    targetType: targetTypeSchema.optional(),
    targetClassId: z.string().uuid().nullable().optional(),
    targetSectionId: z.string().uuid().nullable().optional(),
    targetRole: targetRoleSchema.nullable().optional(),
    publishedAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
    attachments: z.array(z.string().trim().min(1)).optional(),
})
    .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
})
    .refine(validateTargeting, {
    message: "Invalid targeting configuration",
    path: ["targetType"],
});
export const listNoticeQuerySchema = paginationQuerySchema
    .extend({
    noticeType: z.string().trim().min(1).optional(),
    active: z.union([z.literal("true"), z.literal("false"), z.boolean()]).optional(),
    classId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
    roleType: targetRoleSchema.optional(),
})
    .strict();
export const listNoticeMeQuerySchema = paginationQuerySchema
    .extend({
    active: z.union([z.literal("true"), z.literal("false"), z.boolean()]).optional(),
})
    .strict();
