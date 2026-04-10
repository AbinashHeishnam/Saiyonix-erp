import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

vi.mock("../src/utils/audit", () => ({
  logAudit: vi.fn(),
}));

vi.mock("../src/core/cacheService", () => ({
  cacheInvalidateByPrefix: vi.fn(),
}));

import prisma from "../src/config/prisma";
import { logAudit } from "../src/utils/audit";
import { createMark, updateMark } from "../src/modules/marks/service";

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

describe("phase3 marks service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTransaction();
  });

  it("rejects invalid marks greater than maxMarks", async () => {
    mockedPrisma.teacher.findFirst.mockResolvedValue({ id: "teacher-1" } as never);
    mockedPrisma.examSubject.findFirst.mockResolvedValue({
      id: "exam-subject-1",
      maxMarks: new Prisma.Decimal(50),
      classSubjectId: "class-subject-1",
      classSubject: { classId: "class-1" },
      exam: { id: "exam-1", isLocked: false, academicYearId: "ay-1" },
    } as never);

    await expect(
      createMark(
        schoolId,
        { examSubjectId: "exam-subject-1", studentId: "student-1", marksObtained: 90 },
        { roleType: "TEACHER", userId: "user-1" }
      )
    ).rejects.toThrow("Marks obtained cannot exceed max marks");
  });

  it("blocks updates when marks are locked", async () => {
    mockedPrisma.teacher.findFirst.mockResolvedValue({ id: "teacher-1" } as never);
    mockedPrisma.mark.findFirst.mockResolvedValue({
      id: "mark-1",
      studentId: "student-1",
      examSubjectId: "exam-subject-1",
      marksObtained: new Prisma.Decimal(30),
      enteredAt: new Date(),
      lastEditedAt: null,
      enteredByTeacherId: "teacher-1",
      examSubject: {
        maxMarks: new Prisma.Decimal(100),
        classSubjectId: "class-subject-1",
        classSubject: { classId: "class-1" },
        exam: { schoolId, isLocked: true, academicYearId: "ay-1" },
      },
    } as never);

    await expect(
      updateMark(
        schoolId,
        "mark-1",
        { marksObtained: 40 },
        { roleType: "TEACHER", userId: "user-1" }
      )
    ).rejects.toThrow("Marks are locked for this exam");
  });

  it("enforces the 24-hour edit window", async () => {
    mockedPrisma.teacher.findFirst.mockResolvedValue({ id: "teacher-1" } as never);
    mockedPrisma.mark.findFirst.mockResolvedValue({
      id: "mark-1",
      studentId: "student-1",
      examSubjectId: "exam-subject-1",
      marksObtained: new Prisma.Decimal(30),
      enteredAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      lastEditedAt: null,
      enteredByTeacherId: "teacher-1",
      examSubject: {
        maxMarks: new Prisma.Decimal(100),
        classSubjectId: "class-subject-1",
        classSubject: { classId: "class-1" },
        exam: { schoolId, isLocked: false, academicYearId: "ay-1" },
      },
    } as never);

    await expect(
      updateMark(
        schoolId,
        "mark-1",
        { marksObtained: 40 },
        { roleType: "TEACHER", userId: "user-1" }
      )
    ).rejects.toThrow("Edit window expired");
  });

  it("logs audit entries for mark edits", async () => {
    mockedPrisma.teacher.findFirst.mockResolvedValue({ id: "teacher-1" } as never);
    mockedPrisma.mark.findFirst.mockResolvedValue({
      id: "mark-1",
      studentId: "student-1",
      examSubjectId: "exam-subject-1",
      marksObtained: new Prisma.Decimal(30),
      enteredAt: new Date(),
      lastEditedAt: null,
      enteredByTeacherId: "teacher-1",
      examSubject: {
        maxMarks: new Prisma.Decimal(100),
        classSubjectId: "class-subject-1",
        classSubject: { classId: "class-1" },
        exam: { schoolId, isLocked: false, academicYearId: "ay-1" },
      },
    } as never);
    mockedPrisma.studentEnrollment.findFirst.mockResolvedValue({
      sectionId: "section-1",
    } as never);
    mockedPrisma.section.findFirst.mockResolvedValue({ id: "section-1" } as never);
    mockedPrisma.mark.update.mockResolvedValue({
      id: "mark-1",
      studentId: "student-1",
      examSubjectId: "exam-subject-1",
      marksObtained: new Prisma.Decimal(40),
      lastEditedAt: new Date(),
    } as never);
    mockedPrisma.markEditLog.create.mockResolvedValue({ id: "mel-1" } as never);

    await updateMark(
      schoolId,
      "mark-1",
      { marksObtained: 40 },
      { roleType: "TEACHER", userId: "user-1" }
    );

    expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "MARK_EDITED", entity: "Mark" })
    );
  });
});
