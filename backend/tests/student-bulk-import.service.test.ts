import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

import prisma from "../src/config/prisma";
import { importStudentsFromFile } from "../src/modules/studentBulkImport/service";

const mockedPrisma = vi.mocked(prisma, true);

const csvHeader =
  "fullName,dateOfBirth,gender,academicYearId,classId,sectionId,parentName,parentMobile";

const baseRow =
  "Student One,01/01/2010,Male,11111111-1111-1111-8111-111111111111,22222222-2222-2222-8222-222222222222,33333333-3333-3333-8333-333333333333,Parent One,9999999999";

const schoolId = "school-1";

describe("student bulk import service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedPrisma.school.findFirst.mockResolvedValue({ id: schoolId, code: "SCH" } as never);
    mockedPrisma.academicYear.findMany.mockResolvedValue([
      { id: "11111111-1111-1111-8111-111111111111" },
    ] as never);
    mockedPrisma.class.findMany.mockResolvedValue([
      {
        id: "22222222-2222-2222-8222-222222222222",
        academicYearId: "11111111-1111-1111-8111-111111111111",
      },
    ] as never);
    mockedPrisma.section.findMany.mockResolvedValue([
      {
        id: "33333333-3333-3333-8333-333333333333",
        classId: "22222222-2222-2222-8222-222222222222",
      },
    ] as never);
    mockedPrisma.student.findMany.mockResolvedValue([] as never);
    mockedPrisma.studentEnrollment.findMany.mockResolvedValue([] as never);
    mockedPrisma.studentEnrollment.aggregate.mockResolvedValue({
      _max: { rollNumber: 0 },
    } as never);

    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        parent: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "parent-1" }),
        },
        student: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "student-1" }),
        },
        studentProfile: {
          create: vi.fn().mockResolvedValue({ id: "profile-1" }),
        },
        parentStudentLink: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "link-1" }),
        },
        studentEnrollment: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "enroll-1" }),
        },
      };
      return callback(tx as never);
    });
  });

  it("imports students successfully", async () => {
    const csv = `${csvHeader}\n${baseRow}`;

    const result = await importStudentsFromFile(
      schoolId,
      Buffer.from(csv),
      "csv",
      { batchSize: 50 }
    );

    expect(result.created).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockedPrisma.$transaction).toHaveBeenCalled();
  });

  it("returns row errors for duplicates in file", async () => {
    const row2 = baseRow.replace("Student One", "Student Two");
    const csv = `${csvHeader},registrationNumber\n${baseRow},REG-001\n${row2},REG-001`;

    const result = await importStudentsFromFile(
      schoolId,
      Buffer.from(csv),
      "csv",
      { batchSize: 50 }
    );

    expect(result.failed).toBeGreaterThan(0);
    expect(result.errors[0].errors.join(" ")).toMatch(/Duplicate registrationNumber/);
  });

  it("returns errors for invalid class reference", async () => {
    mockedPrisma.class.findMany.mockResolvedValue([] as never);

    const csv = `${csvHeader}\n${baseRow}`;

    const result = await importStudentsFromFile(
      schoolId,
      Buffer.from(csv),
      "csv",
      { batchSize: 50 }
    );

    expect(result.created).toBe(0);
    expect(result.failed).toBeGreaterThan(0);
    expect(result.errors[0].errors.join(" ")).toMatch(/Class not found/);
  });
});
