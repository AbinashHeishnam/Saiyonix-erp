import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import type { UpdateSchoolOverviewInput } from "@/modules/school/overview.validation";

export type SchoolOverview = {
  schoolName: string;
  schoolAddress: string | null;
  schoolPhone: string | null;
  officialEmail: string | null;
  logoUrl: string | null;
};

export async function getSchoolOverview(schoolId: string): Promise<SchoolOverview> {
  const school = await prisma.school.findFirst({
    where: { id: schoolId },
    select: {
      name: true,
      address: true,
      phone: true,
      email: true,
      logoUrl: true,
    },
  });

  if (!school) {
    throw new ApiError(404, "School not found");
  }

  return {
    schoolName: school.name,
    schoolAddress: school.address ?? null,
    schoolPhone: school.phone ?? null,
    officialEmail: school.email ?? null,
    logoUrl: school.logoUrl ?? null,
  };
}

export async function getPublicSchoolOverview(): Promise<SchoolOverview> {
  const school = await prisma.school.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      name: true,
      address: true,
      phone: true,
      email: true,
      logoUrl: true,
    },
  });

  if (!school) {
    throw new ApiError(404, "School not found");
  }

  return {
    schoolName: school.name,
    schoolAddress: school.address ?? null,
    schoolPhone: school.phone ?? null,
    officialEmail: school.email ?? null,
    logoUrl: school.logoUrl ?? null,
  };
}

export async function updateSchoolOverview(
  schoolId: string,
  payload: UpdateSchoolOverviewInput
): Promise<SchoolOverview> {
  const school = await prisma.school.findFirst({
    where: { id: schoolId },
    select: { id: true },
  });
  if (!school) {
    throw new ApiError(404, "School not found");
  }

  const updated = await prisma.school.update({
    where: { id: schoolId },
    data: {
      name: payload.schoolName.trim(),
      address: payload.schoolAddress.trim(),
      phone: payload.schoolPhone.trim(),
      email: payload.officialEmail.trim(),
      logoUrl: payload.logoUrl ?? null,
    },
    select: {
      name: true,
      address: true,
      phone: true,
      email: true,
      logoUrl: true,
    },
  });

  return {
    schoolName: updated.name,
    schoolAddress: updated.address ?? null,
    schoolPhone: updated.phone ?? null,
    officialEmail: updated.email ?? null,
    logoUrl: updated.logoUrl ?? null,
  };
}
