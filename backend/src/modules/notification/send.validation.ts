import { z } from "zod";

export const notificationTargetSchema = z.enum([
  "ENTIRE_SCHOOL",
  "ALL_STUDENTS",
  "ALL_TEACHERS",
  "ALL_PARENTS",
  "CLASS",
  "SECTION",
]);

export const notificationPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const notificationCategorySchema = z.enum([
  "ACADEMIC",
  "HOLIDAY",
  "EXAM",
  "EMERGENCY",
  "GENERAL",
]);

const baseSendSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  priority: notificationPrioritySchema,
  category: notificationCategorySchema.optional(),
  targetType: notificationTargetSchema,
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  linkUrl: z.string().trim().min(1).optional(),
  entityType: z.string().trim().min(1).optional(),
  entityId: z.string().trim().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function validateTargeting(data: z.infer<typeof baseSendSchema>) {
  if (data.targetType === "CLASS") {
    return Boolean(data.classId) && !data.sectionId;
  }

  if (data.targetType === "SECTION") {
    return Boolean(data.sectionId) && !data.classId;
  }

  return !data.classId && !data.sectionId;
}

export const sendNotificationSchema = baseSendSchema.refine(validateTargeting, {
  message: "Invalid targeting configuration",
  path: ["targetType"],
});

export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;
