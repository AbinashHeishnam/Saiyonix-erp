import { Prisma } from "@prisma/client";

import prisma, { enforceQueryLimits } from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import { bumpCacheVersion, cacheGet, cacheSet, getCacheVersion } from "@/core/cacheService";
import { chunkArray, withConsoleTime, withTiming } from "@/core/utils/perf";
import { resolveStudentEnrollmentForPortal } from "@/modules/student/enrollmentUtils";

type ActorContext = {
  userId?: string;
  roleType?: string;
};

type ScoreRow = {
  studentId: string;
  totalMarks: Prisma.Decimal | null;
  percentage: Prisma.Decimal | null;
  studentFirstName: string;
};

type EnrollmentRow = {
  studentId: string;
  classId: string;
  sectionId: string | null;
  createdAt: Date;
};

const MAX_RANKING_BATCH = 20000;

function getFirstName(fullName?: string | null) {
  if (!fullName) return "";
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? "";
}

function ensureActor(actor: ActorContext): { userId: string; roleType: string } {
  if (!actor.userId || !actor.roleType) {
    throw new ApiError(401, "Unauthorized");
  }

  return { userId: actor.userId, roleType: actor.roleType };
}

function isAdminRole(roleType: string) {
  return roleType === "SUPER_ADMIN" || roleType === "ADMIN" || roleType === "ACADEMIC_SUB_ADMIN";
}

async function resolveStudentContextForActor(
  schoolId: string,
  actor: ActorContext
): Promise<{ classId: string; sectionId: string; studentId: string; academicYearId: string }> {
  const { userId, roleType } = ensureActor(actor);

  if (roleType === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { schoolId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!student) {
      throw new ApiError(403, "Student account not linked");
    }

    const enrollment = await resolveStudentEnrollmentForPortal({
      schoolId,
      studentId: student.id,
      allowPreviousYear: true,
    });

    return {
      studentId: student.id,
      classId: enrollment.classId,
      sectionId: enrollment.sectionId,
      academicYearId: enrollment.academicYearId,
    };
  }

  if (roleType === "PARENT") {
    const parent = await prisma.parent.findFirst({
      where: { schoolId, userId },
      select: { id: true },
    });

    if (!parent) {
      throw new ApiError(403, "Parent account not linked");
    }

    const link = await prisma.parentStudentLink.findFirst({
      where: { parentId: parent.id, student: { schoolId, deletedAt: null } },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      select: { studentId: true },
    });

    if (!link) {
      throw new ApiError(403, "Parent is not linked to any student");
    }

    const enrollment = await resolveStudentEnrollmentForPortal({
      schoolId,
      studentId: link.studentId,
      allowPreviousYear: true,
    });

    return {
      studentId: link.studentId,
      classId: enrollment.classId,
      sectionId: enrollment.sectionId,
      academicYearId: enrollment.academicYearId,
    };
  }

  throw new ApiError(403, "Forbidden");
}

async function ensureExamWithPublishedResults(schoolId: string, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    select: { id: true, academicYearId: true },
  });

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  const published = await prisma.reportCard.findFirst({
    where: { examId, OR: [{ isPublished: true }, { publishedAt: { not: null } }] },
    select: { id: true },
  });

  if (!published) {
    throw new ApiError(400, "Results are not published");
  }

  return exam;
}

function compareScores(a: ScoreRow, b: ScoreRow) {
  const aPct = a.percentage ?? new Prisma.Decimal(0);
  const bPct = b.percentage ?? new Prisma.Decimal(0);
  if (!aPct.equals(bPct)) {
    return bPct.comparedTo(aPct);
  }

  const aTotal = a.totalMarks ?? new Prisma.Decimal(0);
  const bTotal = b.totalMarks ?? new Prisma.Decimal(0);
  if (!aTotal.equals(bTotal)) {
    return bTotal.comparedTo(aTotal);
  }

  const nameCompare = a.studentFirstName.localeCompare(b.studentFirstName);
  if (nameCompare !== 0) {
    return nameCompare;
  }

  return a.studentId.localeCompare(b.studentId);
}

function assignRanks(rows: ScoreRow[]) {
  const sorted = [...rows].sort(compareScores);
  const ranks = new Map<string, number>();
  let rank = 1;

  for (let i = 0; i < sorted.length; i += 1) {
    const row = sorted[i];
    if (i > 0) {
      const prev = sorted[i - 1];
      const currPct = row.percentage ?? new Prisma.Decimal(0);
      const prevPct = prev.percentage ?? new Prisma.Decimal(0);
      const currTotal = row.totalMarks ?? new Prisma.Decimal(0);
      const prevTotal = prev.totalMarks ?? new Prisma.Decimal(0);
      const currName = row.studentFirstName ?? "";
      const prevName = prev.studentFirstName ?? "";

      if (
        !currPct.equals(prevPct) ||
        !currTotal.equals(prevTotal) ||
        currName !== prevName
      ) {
        rank = i + 1;
      }
    }

    ranks.set(row.studentId, rank);
  }

  return ranks;
}

export async function computeRanking(schoolId: string, examId: string) {
  return withConsoleTime(`ranking:compute:${examId}`, async () => {
    const exam = await ensureExamWithPublishedResults(schoolId, examId);

    const reportCards = (await withTiming("ranking:reportCards", () =>
      prisma.reportCard.findMany(enforceQueryLimits({
        where: { examId, OR: [{ isPublished: true }, { publishedAt: { not: null } }], exam: { schoolId } },
        select: {
          studentId: true,
          totalMarks: true,
          percentage: true,
          student: { select: { fullName: true } },
        },
      }))
    )) as unknown as Array<{
      studentId: string;
      totalMarks: Prisma.Decimal | null;
      percentage: Prisma.Decimal | null;
      student: { fullName: string | null } | null;
    }>;

  if (reportCards.length === 0) {
    return { snapshots: [], count: 0 };
  }

  if (reportCards.length > MAX_RANKING_BATCH) {
    throw new ApiError(400, "Ranking recompute batch too large");
  }

    const examSubjects = (await withTiming("ranking:examSubjects", () =>
      prisma.examSubject.findMany(enforceQueryLimits({
        where: {
          examId,
          exam: { schoolId },
          classSubject: { class: { schoolId, deletedAt: null } },
        },
        select: { id: true, classSubject: { select: { classId: true } } },
      }))
    )) as unknown as Array<{ id: string; classSubject: { classId: string } }>;
  const classIds = Array.from(
    new Set(examSubjects.map((subject) => subject.classSubject.classId))
  );
    const enrollments = (await withTiming("ranking:enrollments", () =>
      prisma.studentEnrollment.findMany(enforceQueryLimits({
        where: {
          classId: { in: classIds },
          academicYearId: exam.academicYearId,
          student: { schoolId, deletedAt: null },
        },
        orderBy: { createdAt: "desc" },
        select: { studentId: true, classId: true, sectionId: true, createdAt: true },
      }))
    )) as EnrollmentRow[];

  const latestEnrollmentByStudent = new Map<string, EnrollmentRow>();
  for (const enrollment of enrollments) {
    if (!latestEnrollmentByStudent.has(enrollment.studentId)) {
      latestEnrollmentByStudent.set(enrollment.studentId, enrollment);
    }
  }

  const students = Array.from(latestEnrollmentByStudent.keys());
  const failedStudentIds = new Set<string>();

    const marks = (await withTiming("ranking:marks", () =>
      prisma.mark.findMany(enforceQueryLimits({
        where: {
          studentId: { in: students },
          examSubject: { examId, exam: { schoolId } },
        },
        select: {
          studentId: true,
          marksObtained: true,
          examSubject: { select: { passMarks: true } },
        },
      }))
    )) as unknown as Array<{ studentId: string; marksObtained: Prisma.Decimal; examSubject: { passMarks: Prisma.Decimal } }>;

  for (const mark of marks) {
    if (mark.marksObtained.lt(mark.examSubject.passMarks)) {
      failedStudentIds.add(mark.studentId);
    }
  }
  const reportCardMap = new Map(
    reportCards.map((row) => [
      row.studentId,
      {
        studentId: row.studentId,
        totalMarks: row.totalMarks,
        percentage: row.percentage,
        studentFirstName: getFirstName(row.student?.fullName),
      } as ScoreRow,
    ])
  );
  const scores: ScoreRow[] = [];

  for (const studentId of students) {
    if (failedStudentIds.has(studentId)) {
      continue;
    }
    const report = reportCardMap.get(studentId);
    if (!report) {
      // optional: log for debugging
      // console.warn(`Missing report card for student ${studentId}`);
      continue;
    }

    scores.push(report);
  }

  const schoolRanks = assignRanks(scores);

  const classGroups = new Map<string, ScoreRow[]>();
  const sectionGroups = new Map<string, ScoreRow[]>();

  for (const row of scores) {
    const enrollment = latestEnrollmentByStudent.get(row.studentId);
    if (!enrollment) continue;

    const classKey = enrollment.classId;
    const classList = classGroups.get(classKey) ?? [];
    classList.push(row);
    classGroups.set(classKey, classList);

    if (!enrollment.sectionId) continue;
    const sectionKey = enrollment.sectionId;
    const sectionList = sectionGroups.get(sectionKey) ?? [];
    sectionList.push(row);
    sectionGroups.set(sectionKey, sectionList);
  }

  const classRanks = new Map<string, Map<string, number>>();
  for (const [classId, group] of classGroups.entries()) {
    classRanks.set(classId, assignRanks(group));
  }

  const sectionRanks = new Map<string, Map<string, number>>();
  for (const [sectionId, group] of sectionGroups.entries()) {
    sectionRanks.set(sectionId, assignRanks(group));
  }

  const snapshots = scores.map((row) => {
    const enrollment = latestEnrollmentByStudent.get(row.studentId);
    const classRank = enrollment ? classRanks.get(enrollment.classId)?.get(row.studentId) ?? null : null;
    const sectionRank = enrollment?.sectionId
      ? sectionRanks.get(enrollment.sectionId)?.get(row.studentId) ?? null
      : null;
    const schoolRank = schoolRanks.get(row.studentId) ?? null;

    return {
      examId,
      studentId: row.studentId,
      classRank,
      sectionRank,
      schoolRank,
    };
  });

  for (const snapshot of snapshots) {
    if (snapshot.classRank == null || snapshot.schoolRank == null) {
      throw new ApiError(500, "Incomplete ranking data");
    }
  }

  return { snapshots, count: snapshots.length };
  });
}

export async function recomputeRanking(
  schoolId: string,
  examId: string,
  actor: ActorContext
) {
  const { roleType } = ensureActor(actor);
  if (!isAdminRole(roleType)) {
    throw new ApiError(403, "Forbidden");
  }

  const { snapshots } = await computeRanking(schoolId, examId);

  return prisma.$transaction(async (tx) => {
    await tx.rankSnapshot.deleteMany({ where: { examId } });

    if (snapshots.length === 0) {
      return { examId, count: 0 };
    }

    if (snapshots.length !== new Set(snapshots.map((s) => s.studentId)).size) {
      throw new ApiError(409, "Duplicate ranking entries detected");
    }

    const chunks = chunkArray(snapshots, 1000);
    for (const chunk of chunks) {
      await tx.rankSnapshot.createMany({ data: chunk });
    }

    await bumpCacheVersion("ranking", examId);
    await bumpCacheVersion("report-cards", examId);
    return { examId, count: snapshots.length };
  });
}

export async function getRankingForActor(
  schoolId: string,
  examId: string,
  actor: ActorContext
) {
  const enrollment = await resolveStudentContextForActor(schoolId, actor);
  const version = await getCacheVersion("ranking", examId);
  const cacheKey = `ranking:v${version}:${examId}:${enrollment.studentId}`;
  const cached = await cacheGet<{
    studentId: string;
    classRank: number | null;
    sectionRank: number | null;
    schoolRank: number | null;
  }>(cacheKey);
  if (cached) {
    return cached;
  }

  const snapshot = await prisma.rankSnapshot.findFirst({
    where: { examId, studentId: enrollment.studentId, exam: { schoolId } },
    select: {
      studentId: true,
      classRank: true,
      sectionRank: true,
      schoolRank: true,
    },
  });

  if (!snapshot) {
    throw new ApiError(404, "Rank not found");
  }

  await cacheSet(cacheKey, snapshot, 300);
  return snapshot;
}

export async function listRankingsForAdmin(
  schoolId: string,
  examId: string,
  pagination?: { skip: number; take: number }
) {
  const page = pagination?.skip ? Math.floor(pagination.skip / pagination.take) + 1 : 1;
  const limit = pagination?.take ?? 50;
  const version = await getCacheVersion("ranking", examId);
  const cacheKey = `ranking:v${version}:${examId}:page:${page}:limit:${limit}`;
  const cached = await cacheGet<{ items: any[]; total: number }>(cacheKey);
  if (cached) {
    return { items: cached.items, total: cached.total };
  }

  const [items, total] = await prisma.$transaction([
    prisma.rankSnapshot.findMany(enforceQueryLimits({
      where: { examId, exam: { schoolId } },
      orderBy: [{ schoolRank: "asc" }, { studentId: "asc" }],
      select: {
        studentId: true,
        classRank: true,
        sectionRank: true,
        schoolRank: true,
        student: { select: { fullName: true } },
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    })),
    prisma.rankSnapshot.count({ where: { examId, exam: { schoolId } } }),
  ]);

  await cacheSet(cacheKey, { items, total }, 300);
  return { items, total };
}

export async function getClassRanking(
  schoolId: string,
  examId: string,
  classId: string
) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    select: { id: true, academicYearId: true },
  });
  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  const classRecord = await prisma.class.findFirst({
    where: { id: classId, schoolId, deletedAt: null },
    select: { id: true },
  });
  if (!classRecord) {
    throw new ApiError(404, "Class not found");
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      classId,
      academicYearId: exam.academicYearId,
      student: { schoolId, deletedAt: null },
    },
    select: {
      studentId: true,
      student: { select: { fullName: true } },
    },
    orderBy: [{ student: { fullName: "asc" } }],
  });

  const studentIds = enrollments.map((row) => row.studentId);
  if (studentIds.length === 0) {
    return [];
  }

  const [reportCards, rankSnapshots] = await prisma.$transaction([
    prisma.reportCard.findMany({
      where: { examId, studentId: { in: studentIds } },
      select: { studentId: true, totalMarks: true, percentage: true },
    }),
    prisma.rankSnapshot.findMany({
      where: { examId, studentId: { in: studentIds }, exam: { schoolId } },
      select: { studentId: true, classRank: true, sectionRank: true, schoolRank: true },
    }),
  ]);

  const reportMap = new Map(
    reportCards.map((row) => [row.studentId, row])
  );
  const rankMap = new Map(
    rankSnapshots.map((row) => [row.studentId, row])
  );

  const rows = enrollments.map((enrollment) => {
    const report = reportMap.get(enrollment.studentId);
    return {
      studentId: enrollment.studentId,
      name: enrollment.student.fullName,
      totalMarks: report ? Number(report.totalMarks) : null,
      percentage: report ? Number(report.percentage) : null,
      classRank: rankMap.get(enrollment.studentId)?.classRank ?? null,
      sectionRank: rankMap.get(enrollment.studentId)?.sectionRank ?? null,
      schoolRank: rankMap.get(enrollment.studentId)?.schoolRank ?? null,
    };
  });

  return rows.sort((a, b) => {
    if (a.classRank === null && b.classRank === null) return a.name.localeCompare(b.name);
    if (a.classRank === null) return 1;
    if (b.classRank === null) return -1;
    return a.classRank - b.classRank;
  });
}

export async function primeRankingCacheForExam(
  schoolId: string,
  examId: string,
  studentIds: string[]
) {
  if (studentIds.length === 0) return;
  const version = await getCacheVersion("ranking", examId);
  const chunks = chunkArray(studentIds, 1000);

  for (const chunk of chunks) {
    const snapshots = await prisma.rankSnapshot.findMany(enforceQueryLimits({
      where: { examId, studentId: { in: chunk }, exam: { schoolId } },
      select: { studentId: true, classRank: true, sectionRank: true, schoolRank: true },
    }));

    await Promise.all(
      snapshots.map((snapshot) =>
        cacheSet(`ranking:v${version}:${examId}:${snapshot.studentId}`, snapshot, 300)
      )
    );
  }
}
