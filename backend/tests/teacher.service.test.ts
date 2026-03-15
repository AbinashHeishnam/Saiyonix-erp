import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/prisma", () => ({
  default: {
    teacher: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import prisma from "../src/config/prisma";
import {
  createTeacher,
  getTeacherById,
  getTeachers,
} from "../src/modules/teacher/service";

const mockedPrisma = vi.mocked(prisma, true);

describe("teacher.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("create teacher success", async () => {
    mockedPrisma.teacher.create.mockResolvedValue({
      id: "teacher-1",
      schoolId: "school-1",
      employeeId: "EMP-001",
      fullName: "Teacher One",
    } as never);

    const result = await createTeacher("school-1", {
      employeeId: "EMP-001",
      fullName: "Teacher One",
      designation: "TGT",
      department: "Science",
      joiningDate: new Date("2025-06-01"),
    });

    expect(result).toMatchObject({
      id: "teacher-1",
      schoolId: "school-1",
      employeeId: "EMP-001",
    });

    expect(mockedPrisma.teacher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "school-1",
          employeeId: "EMP-001",
          fullName: "Teacher One",
        }),
      })
    );
  });

  it("duplicate employeeId returns 409", async () => {
    mockedPrisma.teacher.create.mockRejectedValue({ code: "P2002" } as never);

    await expect(
      createTeacher("school-1", {
        employeeId: "EMP-001",
        fullName: "Teacher One",
      })
    ).rejects.toMatchObject({
      status: 409,
      message: "Teacher with this employee ID already exists",
    });
  });

  it("teacher not found returns 404", async () => {
    mockedPrisma.teacher.findFirst.mockResolvedValue(null as never);

    await expect(
      getTeacherById("school-1", "11111111-1111-1111-1111-111111111111")
    ).rejects.toMatchObject({
      status: 404,
      message: "Teacher not found",
    });
  });

  it("cross-school isolation", async () => {
    mockedPrisma.teacher.findMany.mockResolvedValue([] as never);
    mockedPrisma.teacher.count.mockResolvedValue(0 as never);
    mockedPrisma.$transaction.mockResolvedValue([[], 0] as never);

    await getTeachers("school-1");

    expect(mockedPrisma.teacher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "school-1",
          deletedAt: null,
        }),
      })
    );
  });
});
