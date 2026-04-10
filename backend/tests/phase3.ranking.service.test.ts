import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

vi.mock("../src/core/cacheService", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn(),
  cacheInvalidateByPrefix: vi.fn(),
}));

import prisma from "../src/config/prisma";
import { computeRanking } from "../src/modules/ranking/service";

const mockedPrisma = vi.mocked(prisma, true);
const schoolId = "school-1";

describe("phase3 ranking service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies first-name tie-breaker and returns consistent ranks", async () => {
    mockedPrisma.exam.findFirst.mockResolvedValue({
      id: "exam-1",
      academicYearId: "ay-1",
    } as never);

    mockedPrisma.reportCard.findFirst.mockResolvedValue({ id: "rc-1" } as never);

    mockedPrisma.reportCard.findMany.mockResolvedValue([
      {
        studentId: "student-a",
        totalMarks: new Prisma.Decimal(80),
        percentage: new Prisma.Decimal(80),
        student: { fullName: "Bob Alpha" },
      },
      {
        studentId: "student-b",
        totalMarks: new Prisma.Decimal(80),
        percentage: new Prisma.Decimal(80),
        student: { fullName: "Alice Beta" },
      },
    ] as never);

    mockedPrisma.examSubject.findMany.mockResolvedValue([
      { classSubject: { classId: "class-1" } },
    ] as never);

    mockedPrisma.studentEnrollment.findMany.mockResolvedValue([
      {
        studentId: "student-a",
        classId: "class-1",
        sectionId: "section-1",
        createdAt: new Date("2026-01-10"),
      },
      {
        studentId: "student-b",
        classId: "class-1",
        sectionId: "section-1",
        createdAt: new Date("2026-01-09"),
      },
    ] as never);

    const { snapshots } = await computeRanking(schoolId, "exam-1");
    const alice = snapshots.find((snap) => snap.studentId === "student-b");
    const bob = snapshots.find((snap) => snap.studentId === "student-a");

    expect(alice?.classRank).toBe(1);
    expect(bob?.classRank).toBe(2);
    expect(alice?.schoolRank).toBe(1);
    expect(bob?.schoolRank).toBe(2);
  });
});
