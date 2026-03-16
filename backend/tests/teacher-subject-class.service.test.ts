import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

import prisma from "../src/config/prisma";
import {
  createTeacherSubjectClass,
  deleteTeacherSubjectClass,
  getTeacherSubjectClassById,
  getTeacherSubjectClasses,
  updateTeacherSubjectClass,
} from "../src/modules/teacherSubjectClass/service";

const mockedPrisma = vi.mocked(prisma, true);

const schoolId = "school-1";

function mockValidDependencies() {
  mockedPrisma.teacher.findFirst.mockResolvedValue({ id: "teacher-1" } as never);
  mockedPrisma.classSubject.findFirst.mockResolvedValue({
    id: "class-subject-1",
    classId: "class-1",
    class: { academicYearId: "ay-1" },
  } as never);
  mockedPrisma.academicYear.findFirst.mockResolvedValue({ id: "ay-1" } as never);
  mockedPrisma.section.findFirst.mockResolvedValue({
    id: "section-1",
    classId: "class-1",
  } as never);
}

describe("teacherSubjectClass.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidDependencies();
    mockedPrisma.$transaction.mockImplementation(async (input) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }
      return input(mockedPrisma as never);
    });
  });

  it("creates teacher subject class successfully", async () => {
    mockedPrisma.teacherSubjectClass.create.mockResolvedValue({
      id: "tsc-1",
      teacherId: "teacher-1",
      classSubjectId: "class-subject-1",
      sectionId: "section-1",
      academicYearId: "ay-1",
    } as never);

    const result = await createTeacherSubjectClass(schoolId, {
      teacherId: "teacher-1",
      classSubjectId: "class-subject-1",
      sectionId: "section-1",
      academicYearId: "ay-1",
    });

    expect(result).toMatchObject({
      id: "tsc-1",
      teacherId: "teacher-1",
    });
    expect(mockedPrisma.teacherSubjectClass.create).toHaveBeenCalled();
  });

  it("returns 409 on duplicate assignment", async () => {
    mockedPrisma.teacherSubjectClass.create.mockRejectedValue({ code: "P2002" } as never);

    await expect(
      createTeacherSubjectClass(schoolId, {
        teacherId: "teacher-1",
        classSubjectId: "class-subject-1",
        sectionId: "section-1",
        academicYearId: "ay-1",
      })
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it("enforces cross-school isolation on list", async () => {
    mockedPrisma.teacherSubjectClass.findMany.mockResolvedValue([] as never);
    mockedPrisma.teacherSubjectClass.count.mockResolvedValue(0 as never);
    mockedPrisma.$transaction.mockResolvedValue([[], 0] as never);

    await getTeacherSubjectClasses(schoolId, {
      teacherId: "teacher-1",
      classId: "class-1",
      sectionId: "section-1",
    });

    expect(mockedPrisma.teacherSubjectClass.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          classSubject: expect.objectContaining({
            class: expect.objectContaining({ schoolId }),
            subject: expect.objectContaining({ schoolId }),
          }),
        }),
      })
    );
  });

  it("returns 404 when assignment not found", async () => {
    mockedPrisma.teacherSubjectClass.findFirst.mockResolvedValue(null as never);

    await expect(
      getTeacherSubjectClassById(schoolId, "11111111-1111-1111-8111-111111111111")
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it("updates teacher subject class", async () => {
    mockedPrisma.teacherSubjectClass.findFirst.mockResolvedValue({
      id: "tsc-1",
      academicYearId: "ay-1",
      classSubject: { classId: "class-1", class: { academicYearId: "ay-1" } },
    } as never);
    mockedPrisma.teacherSubjectClass.update.mockResolvedValue({ id: "tsc-1" } as never);

    const result = await updateTeacherSubjectClass(schoolId, "tsc-1", {
      sectionId: null,
    });

    expect(result).toMatchObject({ id: "tsc-1" });
  });

  it("deletes teacher subject class", async () => {
    mockedPrisma.teacherSubjectClass.findFirst.mockResolvedValue({ id: "tsc-1" } as never);
    mockedPrisma.teacherSubjectClass.delete.mockResolvedValue({ id: "tsc-1" } as never);

    const result = await deleteTeacherSubjectClass(schoolId, "tsc-1");

    expect(result).toEqual({ id: "tsc-1" });
  });
});
