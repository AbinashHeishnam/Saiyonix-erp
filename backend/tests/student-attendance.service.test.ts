import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/prisma", () => ({
  default: {
    academicYear: { findFirst: vi.fn() },
    section: { findFirst: vi.fn() },
    timetableSlot: { findFirst: vi.fn() },
    teacher: { findFirst: vi.fn() },
    studentEnrollment: { findMany: vi.fn() },
    studentAttendance: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    attendanceCorrection: { create: vi.fn() },
    attendanceAuditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import prisma from "../src/config/prisma";
import {
  getStudentAttendanceById,
  listStudentAttendance,
  markStudentAttendance,
  updateStudentAttendance,
} from "../src/modules/studentAttendance/service";

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

describe("studentAttendance.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTransaction();

    mockedPrisma.academicYear.findFirst.mockResolvedValue({ id: "ay-1" } as never);
    mockedPrisma.section.findFirst.mockResolvedValue({
      id: "section-1",
      classTeacherId: "teacher-1",
    } as never);
    mockedPrisma.timetableSlot.findFirst.mockResolvedValue({ id: "slot-1" } as never);
    mockedPrisma.teacher.findFirst.mockResolvedValue({ id: "teacher-1" } as never);
    mockedPrisma.studentEnrollment.findMany.mockResolvedValue([
      { studentId: "student-1" },
    ] as never);
    mockedPrisma.studentAttendance.findMany.mockResolvedValue([] as never);
  });

  it("marks attendance successfully", async () => {
    mockedPrisma.studentAttendance.create.mockResolvedValue({
      id: "att-1",
      studentId: "student-1",
    } as never);

    const result = await markStudentAttendance(
      schoolId,
      {
        sectionId: "section-1",
        academicYearId: "ay-1",
        timetableSlotId: "slot-1",
        records: [{ studentId: "student-1", status: "PRESENT" }],
      },
      { roleType: "TEACHER", userId: "user-1" }
    );

    expect(result).toHaveLength(1);
    expect(mockedPrisma.studentAttendance.create).toHaveBeenCalled();
  });

  it("returns 409 when attendance already marked", async () => {
    mockedPrisma.studentAttendance.findMany.mockResolvedValueOnce([
      { studentId: "student-1" },
    ] as never);

    await expect(
      markStudentAttendance(
        schoolId,
        {
          sectionId: "section-1",
          academicYearId: "ay-1",
          timetableSlotId: "slot-1",
          records: [{ studentId: "student-1", status: "PRESENT" }],
        },
        { roleType: "TEACHER", userId: "user-1" }
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  it("lists attendance scoped by school", async () => {
    mockedPrisma.studentAttendance.findMany.mockResolvedValue([] as never);
    mockedPrisma.studentAttendance.count.mockResolvedValue(0 as never);
    mockedPrisma.$transaction.mockResolvedValue([[], 0] as never);

    await listStudentAttendance(schoolId, {});

    expect(mockedPrisma.studentAttendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          section: expect.objectContaining({
            class: expect.objectContaining({ schoolId }),
          }),
          student: expect.objectContaining({ schoolId }),
        }),
      })
    );
  });

  it("returns attendance by id", async () => {
    mockedPrisma.studentAttendance.findFirst.mockResolvedValue({ id: "att-1" } as never);

    const result = await getStudentAttendanceById(schoolId, "att-1");

    expect(result).toMatchObject({ id: "att-1" });
  });

  it("updates attendance with correction", async () => {
    const today = new Date();
    const attendanceDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    );

    mockedPrisma.studentAttendance.findFirst.mockResolvedValue({
      id: "att-1",
      status: "PRESENT",
      attendanceDate,
      section: { classTeacherId: "teacher-1" },
    } as never);
    mockedPrisma.studentAttendance.update.mockResolvedValue({ id: "att-1" } as never);

    const result = await updateStudentAttendance(
      schoolId,
      "att-1",
      { status: "ABSENT", correctionReason: "Correction" },
      { roleType: "TEACHER", userId: "user-1" }
    );

    expect(result).toMatchObject({ id: "att-1" });
    expect(mockedPrisma.attendanceCorrection.create).toHaveBeenCalled();
    expect(mockedPrisma.attendanceAuditLog.create).toHaveBeenCalled();
  });
});
