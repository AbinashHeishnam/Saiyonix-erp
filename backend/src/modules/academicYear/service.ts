import { Prisma } from "@prisma/client";

import prisma from "../../config/prisma";
import { ApiError } from "../../utils/apiError";
import type {
  CreateAcademicYearInput,
  UpdateAcademicYearInput,
} from "./validation";

function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ApiError(409, "Academic year with this label already exists");
    }

    if (error.code === "P2003") {
      throw new ApiError(400, "Invalid relation reference");
    }
  }

  throw error;
}

export async function createAcademicYear(
  schoolId: string,
  payload: CreateAcademicYearInput
) {

  try {
    return await prisma.academicYear.create({
      data: {
        schoolId,
        label: payload.label,
        startDate: payload.startDate,
        endDate: payload.endDate,
        isActive: payload.isActive ?? false,
        isLocked: payload.isLocked ?? false,
      },
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function listAcademicYears(
  schoolId: string,
  pagination?: { skip: number; take: number }
) {
  const where = { schoolId };
  const [items, total] = await prisma.$transaction([
    prisma.academicYear.findMany({
      where,
      orderBy: [{ startDate: "desc" }, { label: "asc" }],
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.academicYear.count({ where }),
  ]);

  return { items, total };
}

export async function getAcademicYearById(schoolId: string, id: string) {
  const academicYear = await prisma.academicYear.findFirst({
    where: {
      id,
      schoolId,
    },
  });

  if (!academicYear) {
    throw new ApiError(404, "Academic year not found");
  }

  return academicYear;
}

export async function updateAcademicYear(
  schoolId: string,
  id: string,
  payload: UpdateAcademicYearInput
) {
  await getAcademicYearById(schoolId, id);

  try {
    return await prisma.academicYear.update({
      where: { id },
      data: {
        ...(payload.label !== undefined ? { label: payload.label } : {}),
        ...(payload.startDate !== undefined ? { startDate: payload.startDate } : {}),
        ...(payload.endDate !== undefined ? { endDate: payload.endDate } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        ...(payload.isLocked !== undefined ? { isLocked: payload.isLocked } : {}),
      },
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function deleteAcademicYear(schoolId: string, id: string) {
  await getAcademicYearById(schoolId, id);

  try {
    await prisma.academicYear.delete({
      where: { id },
    });
  } catch (error) {
    mapPrismaError(error);
  }

  return { id };
}
