import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
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
import {
  computeAdmitCardEligibility,
  generateAdmitCardPDF,
} from "../src/modules/admitCards/service";

const mockedPrisma = vi.mocked(prisma, true);
const schoolId = "school-1";

function setupTransaction() {
  mockedPrisma.$transaction.mockImplementation(async (input) => {
    if (Array.isArray(input)) {
      return Promise.all(input);
    }
    return input(mockedPrisma as never);
  });
}

describe("phase3 admit cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTransaction();
  });

  it("computes eligibility from attendance + fee rules", async () => {
    mockedPrisma.exam.findFirst.mockResolvedValue({
      id: "exam-1",
      academicYearId: "ay-1",
      termNo: 1,
      title: "Term 1",
      isPublished: true,
      startsOn: null,
      endsOn: null,
    } as never);

    mockedPrisma.academicYear.findFirst.mockResolvedValue({
      id: "ay-1",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
    } as never);

    mockedPrisma.examSubject.findMany.mockResolvedValue([
      { classSubject: { classId: "class-1" } },
    ] as never);

    mockedPrisma.studentEnrollment.findMany.mockResolvedValue([
      {
        studentId: "student-1",
        classId: "class-1",
        sectionId: "section-1",
        createdAt: new Date("2026-01-10"),
      },
      {
        studentId: "student-2",
        classId: "class-1",
        sectionId: "section-1",
        createdAt: new Date("2026-01-09"),
      },
    ] as never);

    mockedPrisma.studentAttendance.groupBy.mockImplementation(async (args: any) => {
      if (args.where?.status) {
        return [
          { studentId: "student-1", _count: { _all: 8 } },
          { studentId: "student-2", _count: { _all: 6 } },
        ] as never;
      }
      return [
        { studentId: "student-1", _count: { _all: 10 } },
        { studentId: "student-2", _count: { _all: 10 } },
      ] as never;
    });

    mockedPrisma.feeTerm.findFirst.mockResolvedValue({ id: "fee-term-1" } as never);
    mockedPrisma.feeDeadline.findMany.mockResolvedValue([
      { classId: null, dueDate: new Date("2026-02-01") },
    ] as never);
    mockedPrisma.payment.findMany.mockResolvedValue([
      { studentId: "student-1", paidAt: new Date("2026-01-15") },
    ] as never);

    const result = await computeAdmitCardEligibility(schoolId, "exam-1");
    const student1 = result.get("student-1");
    const student2 = result.get("student-2");

    expect(student1?.isLocked).toBe(false);
    expect(student1?.lockReason).toBeNull();
    expect(student2?.isLocked).toBe(true);
    expect(student2?.lockReason).toBe("FEES_PENDING,LOW_ATTENDANCE");
  });

  it("blocks PDF generation when admit card is locked", async () => {
    mockedPrisma.exam.findFirst.mockResolvedValue({
      id: "exam-1",
      academicYearId: "ay-1",
      termNo: 1,
      title: "Term 1",
      isPublished: true,
      startsOn: null,
      endsOn: null,
    } as never);

    mockedPrisma.admitCard.findFirst.mockResolvedValue({
      id: "admit-1",
      status: "LOCKED",
      admitCardNumber: "ADM-1",
    } as never);

    await expect(
      generateAdmitCardPDF(schoolId, "exam-1", "student-1")
    ).rejects.toThrow("Admit card is locked");
  });
});
