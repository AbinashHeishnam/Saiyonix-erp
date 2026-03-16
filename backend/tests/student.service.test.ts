import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

import prisma from "../src/config/prisma";
import {
  createStudent,
  deleteStudent,
  listStudents,
} from "../src/modules/student/service";

const mockedPrisma = vi.mocked(prisma, true);

const schoolId = "school-1";

const baseEnrollment = {
  academicYearId: "ay-1",
  classId: "class-1",
  sectionId: "section-1",
  rollNumber: 10,
};

function mockEnrollmentDependencies() {
  mockedPrisma.academicYear.findFirst.mockResolvedValue({ id: "ay-1" } as never);
  mockedPrisma.class.findFirst.mockResolvedValue({
    id: "class-1",
    academicYearId: "ay-1",
  } as never);
  mockedPrisma.section.findFirst.mockResolvedValue({
    id: "section-1",
    classId: "class-1",
  } as never);
}

describe("student.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnrollmentDependencies();
  });

  it("creates student with parent, profile, and enrollment", async () => {
    mockedPrisma.studentEnrollment.findFirst.mockResolvedValue(null as never);
    mockedPrisma.parent.findFirst.mockResolvedValue(null as never);
    mockedPrisma.parent.create.mockResolvedValue({ id: "parent-1" } as never);
    mockedPrisma.student.create.mockResolvedValue({ id: "student-1" } as never);
    mockedPrisma.studentProfile.findFirst.mockResolvedValue(null as never);
    mockedPrisma.studentProfile.create.mockResolvedValue({ id: "profile-1" } as never);
    mockedPrisma.parentStudentLink.findFirst.mockResolvedValue(null as never);
    mockedPrisma.parentStudentLink.create.mockResolvedValue({ id: "link-1" } as never);
    mockedPrisma.studentEnrollment.create.mockResolvedValue({ id: "enroll-1" } as never);
    mockedPrisma.student.findFirst.mockResolvedValue({ id: "student-1" } as never);
    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        parent: mockedPrisma.parent,
        student: mockedPrisma.student,
        studentProfile: mockedPrisma.studentProfile,
        parentStudentLink: mockedPrisma.parentStudentLink,
        studentEnrollment: mockedPrisma.studentEnrollment,
      };
      return callback(tx as never);
    });

    const result = await createStudent(schoolId, {
      registrationNumber: "REG-001",
      fullName: "Student One",
      dateOfBirth: new Date("2010-01-01"),
      gender: "Male",
      enrollment: baseEnrollment,
      parent: {
        fullName: "Parent One",
        mobile: "9999999999",
        isPrimary: true,
      },
      profile: {
        address: "Address",
      },
    });

    expect(result).toMatchObject({ id: "student-1" });
    expect(mockedPrisma.student.create).toHaveBeenCalled();
    expect(mockedPrisma.studentEnrollment.create).toHaveBeenCalled();
  });

  it("returns 409 on duplicate registration number", async () => {
    mockedPrisma.parent.findFirst.mockResolvedValue(null as never);
    mockedPrisma.parent.create.mockResolvedValue({ id: "parent-1" } as never);
    mockedPrisma.student.create.mockRejectedValue({
      code: "P2002",
      meta: { target: ["registrationNumber"] },
    } as never);
    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        parent: mockedPrisma.parent,
        student: mockedPrisma.student,
        studentProfile: mockedPrisma.studentProfile,
        parentStudentLink: mockedPrisma.parentStudentLink,
        studentEnrollment: mockedPrisma.studentEnrollment,
      };
      return callback(tx as never);
    });

    await expect(
      createStudent(schoolId, {
        registrationNumber: "REG-001",
        fullName: "Student One",
        dateOfBirth: new Date("2010-01-01"),
        gender: "Male",
        enrollment: baseEnrollment,
        parent: {
          fullName: "Parent One",
          mobile: "9999999999",
        },
      })
    ).rejects.toMatchObject({ status: 409 });
  });

  it("returns 409 when roll number already exists in section", async () => {
    mockedPrisma.studentEnrollment.findFirst.mockResolvedValue({ id: "enroll-1" } as never);
    mockedPrisma.parent.findFirst.mockResolvedValue(null as never);
    mockedPrisma.parent.create.mockResolvedValue({ id: "parent-1" } as never);
    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        parent: mockedPrisma.parent,
        student: mockedPrisma.student,
        studentProfile: mockedPrisma.studentProfile,
        parentStudentLink: mockedPrisma.parentStudentLink,
        studentEnrollment: mockedPrisma.studentEnrollment,
      };
      return callback(tx as never);
    });

    await expect(
      createStudent(schoolId, {
        registrationNumber: "REG-001",
        fullName: "Student One",
        dateOfBirth: new Date("2010-01-01"),
        gender: "Male",
        enrollment: baseEnrollment,
        parent: {
          fullName: "Parent One",
          mobile: "9999999999",
        },
      })
    ).rejects.toMatchObject({ status: 409 });
  });

  it("lists students scoped by schoolId", async () => {
    mockedPrisma.student.findMany.mockResolvedValue([] as never);
    mockedPrisma.student.count.mockResolvedValue(0 as never);
    mockedPrisma.$transaction.mockResolvedValue([[], 0] as never);

    await listStudents(schoolId);

    expect(mockedPrisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId, deletedAt: null },
      })
    );
  });

  it("soft deletes student", async () => {
    mockedPrisma.student.findFirst.mockResolvedValue({ id: "student-1" } as never);
    mockedPrisma.student.update.mockResolvedValue({ id: "student-1" } as never);

    const result = await deleteStudent(schoolId, "student-1");

    expect(result).toMatchObject({ id: "student-1" });
    expect(mockedPrisma.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
  });
});
