import { Prisma } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import type {
  AutoGeneratePeriodsInput,
  CreatePeriodInput,
  UpdatePeriodInput,
} from "@/modules/period/validation";

function toTimeDate(time: string) {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return new Date(`1970-01-01T${normalized}.000Z`);
}

function parseTimeToMinutes(time: string) {
  const parts = time.split(":").map((value) => Number.parseInt(value, 10));
  if (parts.some((value) => Number.isNaN(value))) {
    throw new ApiError(400, "Invalid time format");
  }
  const [hours, minutes] = parts;
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const hh = String(hrs).padStart(2, "0");
  const mm = String(mins).padStart(2, "0");
  return `${hh}:${mm}`;
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
  pagination?: { skip: number; take: number },
  _academicYearId?: string
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

export async function autoGeneratePeriods(
  schoolId: string,
  payload: AutoGeneratePeriodsInput
) {
  const startMinutes = parseTimeToMinutes(payload.startTime);
  const endMinutes = parseTimeToMinutes(payload.endTime);

  if (endMinutes <= startMinutes) {
    throw new ApiError(400, "endTime must be after startTime");
  }

  const totalMinutes = endMinutes - startMinutes;
  if (payload.periods <= 0) {
    throw new ApiError(400, "Periods must be greater than 0");
  }

  const baseDuration = Math.floor(totalMinutes / payload.periods);
  const remainder = totalMinutes % payload.periods;

  const data = Array.from({ length: payload.periods }).map((_, index) => {
    const extra = index < remainder ? 1 : 0;
    const periodStart =
      startMinutes +
      baseDuration * index +
      Math.min(index, remainder);
    const periodEnd = periodStart + baseDuration + extra;
    const periodNumber = index + 1;
    return {
      schoolId,
      periodNumber,
      startTime: toTimeDate(minutesToTime(periodStart)),
      endTime: toTimeDate(minutesToTime(periodEnd)),
      isLunch: payload.lunchAfter ? periodNumber === payload.lunchAfter : false,
      isFirstPeriod: periodNumber === 1,
    };
  });

  try {
    const created = await prisma.$transaction(
      data.map((item) =>
        prisma.period.create({
          data: item,
        })
      )
    );

    return { count: created.length };
  } catch (error) {
    mapPrismaError(error);
  }
}
