import { Prisma } from "@prisma/client";

import prisma from "../../core/db/prisma";
import { ApiError } from "../../core/errors/apiError";
import type { CreatePeriodInput, UpdatePeriodInput } from "./validation";

function toTimeDate(time: string) {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return new Date(`1970-01-01T${normalized}.000Z`);
}

function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ApiError(409, "Period number already exists");
    }

    if (error.code === "P2003") {
      throw new ApiError(400, "Invalid relation reference");
    }
  }

  throw error;
}

export async function createPeriod(schoolId: string, payload: CreatePeriodInput) {
  try {
    return await prisma.period.create({
      data: {
        schoolId,
        periodNumber: payload.periodNumber,
        startTime: toTimeDate(payload.startTime),
        endTime: toTimeDate(payload.endTime),
        isLunch: payload.isLunch ?? false,
        isFirstPeriod: payload.isFirstPeriod ?? false,
      },
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function listPeriods(
  schoolId: string,
  pagination?: { skip: number; take: number }
) {
  const where = { schoolId };
  const [items, total] = await prisma.$transaction([
    prisma.period.findMany({
      where,
      orderBy: [{ periodNumber: "asc" }],
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.period.count({ where }),
  ]);

  return { items, total };
}

export async function getPeriodById(schoolId: string, id: string) {
  const period = await prisma.period.findFirst({
    where: {
      id,
      schoolId,
    },
  });

  if (!period) {
    throw new ApiError(404, "Period not found");
  }

  return period;
}

export async function updatePeriod(
  schoolId: string,
  id: string,
  payload: UpdatePeriodInput
) {
  await getPeriodById(schoolId, id);

  try {
    return await prisma.period.update({
      where: { id },
      data: {
        ...(payload.periodNumber !== undefined ? { periodNumber: payload.periodNumber } : {}),
        ...(payload.startTime !== undefined ? { startTime: toTimeDate(payload.startTime) } : {}),
        ...(payload.endTime !== undefined ? { endTime: toTimeDate(payload.endTime) } : {}),
        ...(payload.isLunch !== undefined ? { isLunch: payload.isLunch } : {}),
        ...(payload.isFirstPeriod !== undefined
          ? { isFirstPeriod: payload.isFirstPeriod }
          : {}),
      },
    });
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function deletePeriod(schoolId: string, id: string) {
  await getPeriodById(schoolId, id);

  try {
    await prisma.period.delete({
      where: { id },
    });
  } catch (error) {
    mapPrismaError(error);
  }

  return { id };
}
