import { Prisma } from "@prisma/client";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import type {
  CopyClassSubjectConfigInput,
  UpsertClassSubjectConfigInput,
} from "@/modules/classSubjectConfig/validation";

function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ApiError(409, "Class subject configuration already exists");
    }
    if (error.code === "P2003") {
      throw new ApiError(400, "Invalid relation reference");
    }
  }
  throw error;
}

async function ensureClassBelongsToSchool(schoolId: string, classId: string) {
  const record = await prisma.class.findFirst({
    where: { id: classId, schoolId, deletedAt: null },
    select: { id: true },
  });
  if (!record) {
    throw new ApiError(400, "Class not found for this school");
  }
}

async function ensureSubjectsBelongToSchool(schoolId: string, subjectIds: string[]) {
  if (subjectIds.length === 0) return;
  const count = await prisma.subject.count({
    where: { id: { in: subjectIds }, schoolId },
  });
  if (count !== subjectIds.length) {
    throw new ApiError(400, "One or more subjects are invalid for this school");
  }
}

export async function upsertClassSubjectConfig(
  schoolId: string,
  payload: UpsertClassSubjectConfigInput
) {
  await ensureClassBelongsToSchool(schoolId, payload.classId);
  await ensureSubjectsBelongToSchool(schoolId, payload.subjectIds);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.classSubjectConfig.deleteMany({ where: { classId: payload.classId } });
      if (payload.subjectIds.length > 0) {
        await tx.classSubjectConfig.createMany({
          data: payload.subjectIds.map((subjectId) => ({
            classId: payload.classId,
            subjectId,
          })),
          skipDuplicates: true,
        });
      }
    });
  } catch (error) {
    mapPrismaError(error);
  }

  return { classId: payload.classId, subjectIds: payload.subjectIds };
}

export async function getClassSubjectConfig(schoolId: string, classId: string) {
  await ensureClassBelongsToSchool(schoolId, classId);

  const items = await prisma.classSubjectConfig.findMany({
    where: { classId },
    select: { subjectId: true },
  });

  return {
    classId,
    subjectIds: items.map((item) => item.subjectId),
  };
}

export async function copyClassSubjectConfigFromPreviousYear(
  schoolId: string,
  payload: CopyClassSubjectConfigInput
) {
  const targetYear = await prisma.academicYear.findFirst({
    where: { id: payload.targetAcademicYearId, schoolId },
    select: { id: true, startDate: true },
  });
  if (!targetYear) {
    throw new ApiError(404, "Academic year not found");
  }

  const previousYear = await prisma.academicYear.findFirst({
    where: { schoolId, startDate: { lt: targetYear.startDate } },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  if (!previousYear) {
    throw new ApiError(400, "Previous academic year not found");
  }

  const [targetClasses, previousClasses] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId, academicYearId: targetYear.id, deletedAt: null },
      select: { id: true, classOrder: true, className: true },
    }),
    prisma.class.findMany({
      where: { schoolId, academicYearId: previousYear.id, deletedAt: null },
      select: { id: true, classOrder: true, className: true },
    }),
  ]);

  if (targetClasses.length === 0) {
    throw new ApiError(400, "No classes found for the selected academic year");
  }

  const previousByOrder = new Map<number, string>();
  const previousByName = new Map<string, string>();
  for (const cls of previousClasses) {
    if (cls.classOrder != null && !previousByOrder.has(cls.classOrder)) {
      previousByOrder.set(cls.classOrder, cls.id);
    }
    if (cls.className) {
      const key = cls.className.trim().toLowerCase();
      if (key && !previousByName.has(key)) {
        previousByName.set(key, cls.id);
      }
    }
  }

  const [previousConfigs, targetConfigs] = await Promise.all([
    prisma.classSubjectConfig.findMany({
      where: { classId: { in: previousClasses.map((item) => item.id) } },
      select: { classId: true, subjectId: true },
    }),
    prisma.classSubjectConfig.findMany({
      where: { classId: { in: targetClasses.map((item) => item.id) } },
      select: { classId: true, subjectId: true },
    }),
  ]);

  const previousSubjectsByClass = new Map<string, string[]>();
  for (const item of previousConfigs) {
    const list = previousSubjectsByClass.get(item.classId) ?? [];
    list.push(item.subjectId);
    previousSubjectsByClass.set(item.classId, list);
  }

  const targetSubjectsByClass = new Map<string, Set<string>>();
  for (const item of targetConfigs) {
    const set = targetSubjectsByClass.get(item.classId) ?? new Set<string>();
    set.add(item.subjectId);
    targetSubjectsByClass.set(item.classId, set);
  }

  let classesMatched = 0;
  let mappingsSkipped = 0;
  const toCreate: { classId: string; subjectId: string }[] = [];

  for (const targetClass of targetClasses) {
    let previousClassId: string | undefined;
    if (targetClass.classOrder != null) {
      previousClassId = previousByOrder.get(targetClass.classOrder);
    }
    if (!previousClassId && targetClass.className) {
      previousClassId = previousByName.get(targetClass.className.trim().toLowerCase());
    }
    if (!previousClassId) {
      continue;
    }

    classesMatched += 1;
    const previousSubjects = previousSubjectsByClass.get(previousClassId) ?? [];
    if (previousSubjects.length === 0) {
      continue;
    }

    const existing = targetSubjectsByClass.get(targetClass.id) ?? new Set<string>();
    for (const subjectId of previousSubjects) {
      if (existing.has(subjectId)) {
        mappingsSkipped += 1;
        continue;
      }
      toCreate.push({ classId: targetClass.id, subjectId });
      existing.add(subjectId);
    }
    targetSubjectsByClass.set(targetClass.id, existing);
  }

  if (toCreate.length > 0) {
    try {
      await prisma.classSubjectConfig.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  return {
    classesMatched,
    mappingsCreated: toCreate.length,
    mappingsSkipped,
  };
}
