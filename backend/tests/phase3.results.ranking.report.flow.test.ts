import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
  enforceQueryLimits: (args: any) => args,
}));

vi.mock("../src/core/cacheService", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn(),
  cacheInvalidateByPrefix: vi.fn(),
}));

vi.mock("../src/utils/audit", () => ({
  logAudit: vi.fn(),
}));

import prisma from "../src/config/prisma";
import { publishResults } from "../src/modules/results/service";
import { recomputeRanking } from "../src/modules/ranking/service";
import { getReportCard } from "../src/modules/reportCards/service";

const mockedPrisma = vi.mocked(prisma, true);

describe("phase3 results → ranking → report flow", () => {
  const schoolId = "school-1";
  const examId = "exam-1";
  const academicYearId = "ay-1";
  const classId = "class-1";
  const sectionId = "section-1";
  const studentId = "student-1";

  const reportCards: Array<any> = [];
  const rankSnapshots: Array<any> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    reportCards.length = 0;
    rankSnapshots.length = 0;

    mockedPrisma.$transaction.mockImplementation(async (arg: any) => {
      if (typeof arg === "function") {
        return arg(mockedPrisma as any);
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    });

    mockedPrisma.exam.findFirst.mockResolvedValue({
      id: examId,
      schoolId,
      academicYearId,
      isPublished: true,
      isLocked: true,
    } as never);

    mockedPrisma.examSubject.findMany.mockResolvedValue([
      {
        id: "es-1",
        maxMarks: new Prisma.Decimal(50),
        passMarks: new Prisma.Decimal(20),
        classSubject: { classId, subject: { name: "Math" } },
      },
      {
        id: "es-2",
        maxMarks: new Prisma.Decimal(50),
        passMarks: new Prisma.Decimal(20),
        classSubject: { classId, subject: { name: "Science" } },
      },
    ] as never);

    mockedPrisma.studentEnrollment.findMany.mockResolvedValue([
      {
        studentId,
        classId,
        sectionId,
        createdAt: new Date(),
      },
    ] as never);

    mockedPrisma.mark.findMany.mockImplementation(async (args: any) => {
      const ids = new Set(args?.where?.examSubjectId?.in ?? []);
      if (!ids.size) return [] as never;
      return [
        { examSubjectId: "es-1", studentId, marksObtained: new Prisma.Decimal(40) },
        { examSubjectId: "es-2", studentId, marksObtained: new Prisma.Decimal(45) },
      ].filter((row) => ids.has(row.examSubjectId)) as never;
    });

    mockedPrisma.reportCard.findFirst.mockImplementation(async (args: any) => {
      const where = args?.where ?? {};
      const match = reportCards.find((row) => {
        if (where.examId && row.examId !== where.examId) return false;
        if (where.studentId && row.studentId !== where.studentId) return false;
        if (where.publishedAt?.not && !row.publishedAt) return false;
        return true;
      });
      return (match ?? null) as never;
    });

    mockedPrisma.reportCard.findMany.mockImplementation(async (args: any) => {
      const where = args?.where ?? {};
      return reportCards
        .filter((row) => {
          if (where.examId && row.examId !== where.examId) return false;
          if (where.publishedAt?.not && !row.publishedAt) return false;
          return true;
        })
        .map((row) => ({
          ...row,
          student: { fullName: "SaiyoniX Student" },
        })) as never;
    });

    mockedPrisma.reportCard.upsert.mockImplementation(async (args: any) => {
      const key = args.where.examId_studentId;
      const existing = reportCards.find(
        (row) => row.examId === key.examId && row.studentId === key.studentId
      );
      if (existing) {
        Object.assign(existing, args.update);
        return existing as never;
      }
      const created = { ...args.create };
      reportCards.push(created);
      return created as never;
    });

    mockedPrisma.reportCard.updateMany.mockImplementation(async (args: any) => {
      const now = args.data?.publishedAt ?? new Date();
      const count = reportCards.reduce((acc, row) => {
        if (!args.where?.examId || row.examId === args.where.examId) {
          row.publishedAt = now;
          return acc + 1;
        }
        return acc;
      }, 0);
      return { count } as never;
    });

    mockedPrisma.rankSnapshot.deleteMany.mockImplementation(async (args: any) => {
      if (!args.where?.examId) {
        rankSnapshots.length = 0;
      } else {
        for (let i = rankSnapshots.length - 1; i >= 0; i -= 1) {
          if (rankSnapshots[i]?.examId === args.where.examId) {
            rankSnapshots.splice(i, 1);
          }
        }
      }
      return { count: 0 } as never;
    });

    mockedPrisma.rankSnapshot.createMany.mockImplementation(async (args: any) => {
      rankSnapshots.push(...args.data);
      return { count: args.data.length } as never;
    });

    mockedPrisma.rankSnapshot.findFirst.mockImplementation(async (args: any) => {
      const where = args?.where ?? {};
      const match = rankSnapshots.find((row) => {
        if (where.examId && row.examId !== where.examId) return false;
        if (where.studentId && row.studentId !== where.studentId) return false;
        return true;
      });
      return (match ?? null) as never;
    });
  });

  it("publishes results, recomputes ranking, and fetches report card details", async () => {
    await publishResults(schoolId, examId, { roleType: "ADMIN", userId: "admin-1" });
    expect(reportCards).toHaveLength(1);
    expect(reportCards[0]?.publishedAt).toBeTruthy();

    await recomputeRanking(schoolId, examId, { roleType: "ADMIN", userId: "admin-1" });
    expect(rankSnapshots).toHaveLength(1);
    expect(rankSnapshots[0]?.classRank).toBe(1);

    const report = await getReportCard(schoolId, examId, studentId);
    expect(report.studentId).toBe(studentId);
    expect(report.totalMarks).toBe(85);
    expect(report.resultStatus).toBe("PASS");
    expect(report.classRank).toBe(1);
  });
});
