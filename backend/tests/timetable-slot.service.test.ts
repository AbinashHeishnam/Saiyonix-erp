import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/prisma", () => ({
  default: {
    academicYear: { findFirst: vi.fn() },
    teacher: { findFirst: vi.fn() },
    period: { findFirst: vi.fn() },
    section: { findFirst: vi.fn() },
    classSubject: { findFirst: vi.fn() },
    teacherSubjectClass: { findFirst: vi.fn() },
    timetableSlot: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import prisma from "../src/config/prisma";
import {
  createTimetableSlot,
  deleteTimetableSlot,
  getTimetableSlotById,
  listTimetableSlots,
  updateTimetableSlot,
} from "../src/modules/timetableSlot/service";

const mockedPrisma = vi.mocked(prisma, true);
const schoolId = "school-1";

function mockDependencies() {
  mockedPrisma.academicYear.findFirst.mockResolvedValue({ id: "ay-1" } as never);
  mockedPrisma.teacher.findFirst.mockResolvedValue({ id: "teacher-1" } as never);
  mockedPrisma.period.findFirst.mockResolvedValue({ id: "period-1" } as never);
  mockedPrisma.section.findFirst.mockResolvedValue({ id: "section-1", classId: "class-1" } as never);
  mockedPrisma.classSubject.findFirst.mockResolvedValue({
    id: "class-subject-1",
    classId: "class-1",
    class: { academicYearId: "ay-1" },
  } as never);
  mockedPrisma.teacherSubjectClass.findFirst.mockResolvedValue({ id: "tsc-1" } as never);
}

describe("timetableSlot.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDependencies();
    mockedPrisma.$transaction.mockImplementation(async (input) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }
      return input(mockedPrisma as never);
    });
  });

  it("creates timetable slot successfully", async () => {
    mockedPrisma.timetableSlot.findFirst.mockResolvedValueOnce(null as never);
    mockedPrisma.timetableSlot.findFirst.mockResolvedValueOnce(null as never);
    mockedPrisma.timetableSlot.create.mockResolvedValue({ id: "slot-1" } as never);

    const result = await createTimetableSlot(schoolId, {
      sectionId: "section-1",
      classSubjectId: "class-subject-1",
      teacherId: "teacher-1",
      academicYearId: "ay-1",
      dayOfWeek: 1,
      periodId: "period-1",
      roomNo: "R-101",
    });

    expect(result).toMatchObject({ id: "slot-1" });
  });

  it("returns 409 on duplicate slot conflict", async () => {
    mockedPrisma.timetableSlot.findFirst.mockResolvedValueOnce({ id: "slot-1" } as never);

    await expect(
      createTimetableSlot(schoolId, {
        sectionId: "section-1",
        classSubjectId: "class-subject-1",
        teacherId: "teacher-1",
        academicYearId: "ay-1",
        dayOfWeek: 1,
        periodId: "period-1",
      })
    ).rejects.toMatchObject({ status: 409 });
  });

  it("returns 409 on teacher conflict", async () => {
    mockedPrisma.timetableSlot.findFirst.mockResolvedValueOnce(null as never);
    mockedPrisma.timetableSlot.findFirst.mockResolvedValueOnce({ id: "slot-2" } as never);

    await expect(
      createTimetableSlot(schoolId, {
        sectionId: "section-1",
        classSubjectId: "class-subject-1",
        teacherId: "teacher-1",
        academicYearId: "ay-1",
        dayOfWeek: 1,
        periodId: "period-1",
      })
    ).rejects.toMatchObject({ status: 409 });
  });

  it("lists timetable slots scoped by school", async () => {
    mockedPrisma.timetableSlot.findMany.mockResolvedValue([] as never);
    mockedPrisma.timetableSlot.count.mockResolvedValue(0 as never);
    mockedPrisma.$transaction.mockResolvedValue([[], 0] as never);

    await listTimetableSlots(schoolId);

    expect(mockedPrisma.timetableSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          section: expect.objectContaining({ class: expect.objectContaining({ schoolId }) }),
          classSubject: expect.objectContaining({
            class: expect.objectContaining({ schoolId }),
            subject: expect.objectContaining({ schoolId }),
          }),
        }),
      })
    );
  });

  it("returns 404 when slot not found", async () => {
    mockedPrisma.timetableSlot.findFirst.mockResolvedValue(null as never);

    await expect(
      getTimetableSlotById(schoolId, "11111111-1111-1111-8111-111111111111")
    ).rejects.toMatchObject({ status: 404 });
  });

  it("updates timetable slot", async () => {
    mockedPrisma.timetableSlot.findFirst.mockResolvedValueOnce({
      id: "slot-1",
      sectionId: "section-1",
      classSubjectId: "class-subject-1",
      teacherId: "teacher-1",
      academicYearId: "ay-1",
      dayOfWeek: 1,
      periodId: "period-1",
    } as never);
    mockedPrisma.timetableSlot.findFirst.mockResolvedValueOnce(null as never);
    mockedPrisma.timetableSlot.findFirst.mockResolvedValueOnce(null as never);
    mockedPrisma.timetableSlot.update.mockResolvedValue({ id: "slot-1" } as never);

    const result = await updateTimetableSlot(schoolId, "slot-1", {
      roomNo: "R-202",
    });

    expect(result).toMatchObject({ id: "slot-1" });
  });

  it("deletes timetable slot", async () => {
    mockedPrisma.timetableSlot.findFirst.mockResolvedValue({ id: "slot-1" } as never);
    mockedPrisma.timetableSlot.delete.mockResolvedValue({ id: "slot-1" } as never);

    const result = await deleteTimetableSlot(schoolId, "slot-1");

    expect(result).toEqual({ id: "slot-1" });
  });
});
