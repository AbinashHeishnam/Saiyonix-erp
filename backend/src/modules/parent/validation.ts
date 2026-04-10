import { z } from "zod";

const optionalTrimmedString = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}, z.string().min(1).nullable().optional());

export const updateParentProfileSchema = z
  .object({
    fullName: optionalTrimmedString,
    mobile: optionalTrimmedString,
    email: z.preprocess((value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    }, z.string().email().nullable().optional()),
    relationToStudent: optionalTrimmedString,
    address: optionalTrimmedString,
    emergencyContactName: optionalTrimmedString,
    emergencyContactMobile: optionalTrimmedString,
    previousSchool: optionalTrimmedString,
    medicalInfo: z.preprocess((value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? null : trimmed;
      }
      return value;
    }, z.any().nullable().optional()),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type UpdateParentProfileInput = z.infer<typeof updateParentProfileSchema>;
