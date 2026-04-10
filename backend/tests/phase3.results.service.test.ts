import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

vi.mock("../src/core/cacheService", () => ({
  cacheInvalidateByPrefix: vi.fn(),
}));

vi.mock("../src/utils/audit", () => ({
  logAudit: vi.fn(),
}));

import prisma from "../src/config/prisma";
import { logAudit } from "../src/utils/audit";
import {
  computeResultsForExam,
  publishResults,
  recomputeResults,
} from "../src/modules/results/service";

const mockedPrisma = vi.mocked(prisma, true);
const schoolId = "school-1";

describe("phase3 results service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes totals and percentage correctly", async () => {
    mockedPrisma.exam.findFirst.mockResolvedValue({
      id: "exam-1",
      academicYearId: "ay-1",
    } as never);

    mockedPrisma.examSubject.findMany.mockResolvedValue([
      {
        id: "es-1",
        maxMarks: new Prisma.Decimal(50),
        passMarks: new Prisma.Decimal(20),
        classSubject: { classId: "class-1" },
      },
      {
        id: "es-2",
        maxMarks: new Prisma.Decimal(50),
        passMarks: new Prisma.Decimal(20),
        classSubject: { classId: "class-1" },
      },
    ] as never);

    mockedPrisma.studentEnrollment.findMany.mockResolvedValue([
      { studentId: "student-1", classId: "class-1", createdAt: new Date() },
    ] as never);

    mockedPrisma.mark.findMany.mockResolvedValue([
      { studentId: "student-1", examSubjectId: "es-1", marksObtained: new Prisma.Decimal(40) },
      { studentId: "student-1", examSubjectId: "es-2", marksObtained: new Prisma.Decimal(45) },
    ] as never);

    const results = await computeResultsForExam(schoolId, "exam-1");
    expect(results).toHaveLength(1);
    expect(Number(results[0]?.totalMarks)).toBe(85);
    expect(Number(results[0]?.percentage)).toBeCloseTo(85, 2);
  });

  it("prevents recompute after results are published", async () => {
    mockedPrisma.exam.findFirst.mockResolvedValue({
      id: "exam-1",
      schoolId,
      isPublished: true,
      isLocked: true,
    } as never);

    mockedPrisma.reportCard.findFirst.mockResolvedValue({ id: "rc-1" } as never);

    await expect(
      recomputeResults(schoolId, "exam-1", { roleType: "ADMIN", userId: "user-1" })
    ).rejects.toThrow("Results already published");
  });

  it("logs audit when results are re-published", async () => {
    mockedPrisma.exam.findFirst.mockResolvedValue({
      id: "exam-1",
      schoolId,
      isPublished: true,
      isLocked: true,
    } as never);

    mockedPrisma.reportCard.findFirst.mockResolvedValue({ id: "rc-1" } as never);

    await publishResults(schoolId, "exam-1", { roleType: "ADMIN", userId: "user-1" });

    expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RESULT_REPUBLISHED", entity: "Exam" })
    );
  });
});
