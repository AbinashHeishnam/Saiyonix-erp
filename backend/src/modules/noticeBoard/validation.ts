import { z } from "zod";

export const noticeIdSchema = z.string().uuid();

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

function isEmpty(value: unknown) {
  return value === undefined || value === null;
}

function validateTargeting(data: {
  targetType?: z.infer<typeof targetTypeSchema>;
  targetClassId?: string | null;
  targetSectionId?: string | null;
  targetRole?: z.infer<typeof targetRoleSchema> | null;
}) {
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
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  })
  .refine(validateTargeting, {
    message: "Invalid targeting configuration",
    path: ["targetType"],
  });

export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;
export type UpdateNoticeInput = z.infer<typeof updateNoticeSchema>;
