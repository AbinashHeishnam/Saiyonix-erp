import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../src/config/prisma", () => ({
  default: {
    academicYear: { findFirst: vi.fn() },
    class: { findFirst: vi.fn() },
    section: { findFirst: vi.fn() },
    student: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    studentProfile: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    parent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    parentStudentLink: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    studentEnrollment: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../src/modules/auth/permission.service", () => ({
  roleHasPermission: vi.fn(),
}));

vi.mock("../src/utils/jwt", () => ({
  verifyToken: vi.fn(),
  signToken: vi.fn(),
}));

import app from "../src/app";
import prisma from "../src/config/prisma";
import { roleHasPermission } from "../src/modules/auth/permission.service";
import { verifyToken } from "../src/utils/jwt";

const mockedPrisma = vi.mocked(prisma, true);
const mockedVerifyToken = vi.mocked(verifyToken);
const mockedRoleHasPermission = vi.mocked(roleHasPermission);

const adminPayload = {
  sub: "user-1",
  email: "admin@saiyonix.test",
  roleId: "role-1",
  roleType: "ADMIN",
  schoolId: "school-1",
};

const teacherPayload = {
  sub: "user-2",
  email: "teacher@saiyonix.test",
  roleId: "role-2",
  roleType: "TEACHER",
  schoolId: "school-1",
};

const ids = {
  academicYearId: "44444444-4444-4444-8444-444444444444",
  classId: "22222222-2222-2222-8222-222222222222",
  sectionId: "11111111-1111-1111-8111-111111111111",
};

describe("student routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifyToken.mockReturnValue(adminPayload);
    mockedRoleHasPermission.mockResolvedValue(true);

    mockedPrisma.academicYear.findFirst.mockResolvedValue({ id: ids.academicYearId } as never);
    mockedPrisma.class.findFirst.mockResolvedValue({
      id: ids.classId,
      academicYearId: ids.academicYearId,
    } as never);
    mockedPrisma.section.findFirst.mockResolvedValue({
      id: ids.sectionId,
      classId: ids.classId,
    } as never);
  });

  it("POST /students success", async () => {
    mockedPrisma.studentEnrollment.findFirst.mockResolvedValue(null as never);
    mockedPrisma.parent.findFirst.mockResolvedValue(null as never);
    mockedPrisma.parent.create.mockResolvedValue({ id: "parent-1" } as never);
    mockedPrisma.student.create.mockResolvedValue({ id: "student-1" } as never);
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

    const response = await request(app)
      .post("/api/v1/students")
      .set("Authorization", "Bearer valid-token")
      .send({
        registrationNumber: "REG-001",
        fullName: "Student One",
        dateOfBirth: "2010-01-01",
        gender: "Male",
        enrollment: {
          academicYearId: ids.academicYearId,
          classId: ids.classId,
          sectionId: ids.sectionId,
          rollNumber: 10,
        },
        parent: {
          fullName: "Parent One",
          mobile: "9999999999",
          isPrimary: true,
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("POST /students returns 409 on duplicate registrationNumber", async () => {
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

    const response = await request(app)
      .post("/api/v1/students")
      .set("Authorization", "Bearer valid-token")
      .send({
        registrationNumber: "REG-001",
        fullName: "Student One",
        dateOfBirth: "2010-01-01",
        gender: "Male",
        enrollment: {
          academicYearId: ids.academicYearId,
          classId: ids.classId,
          sectionId: ids.sectionId,
        },
        parent: {
          fullName: "Parent One",
          mobile: "9999999999",
        },
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("GET /students list", async () => {
    mockedPrisma.student.findMany.mockResolvedValue([] as never);
    mockedPrisma.student.count.mockResolvedValue(0 as never);
    mockedPrisma.$transaction.mockResolvedValue([[], 0] as never);

    const response = await request(app)
      .get("/api/v1/students")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("GET /students/:id returns 404 when not found", async () => {
    mockedPrisma.student.findFirst.mockResolvedValue(null as never);

    const response = await request(app)
      .get("/api/v1/students/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("PATCH /students/:id updates student", async () => {
    mockedPrisma.student.findFirst.mockResolvedValue({ id: "student-1" } as never);
    mockedPrisma.student.update.mockResolvedValue({ id: "student-1" } as never);
    mockedPrisma.student.findFirst.mockResolvedValueOnce({ id: "student-1" } as never);
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

    const response = await request(app)
      .patch("/api/v1/students/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token")
      .send({ fullName: "Updated Student" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("DELETE /students/:id soft deletes student", async () => {
    mockedPrisma.student.findFirst.mockResolvedValue({ id: "student-1" } as never);
    mockedPrisma.student.update.mockResolvedValue({ id: "student-1" } as never);

    const response = await request(app)
      .delete("/api/v1/students/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("POST denied for non-admin role", async () => {
    mockedVerifyToken.mockReturnValue(teacherPayload);

    const response = await request(app)
      .post("/api/v1/students")
      .set("Authorization", "Bearer valid-token")
      .send({
        registrationNumber: "REG-001",
        fullName: "Student One",
        dateOfBirth: "2010-01-01",
        gender: "Male",
        enrollment: {
          academicYearId: ids.academicYearId,
          classId: ids.classId,
          sectionId: ids.sectionId,
        },
        parent: {
          fullName: "Parent One",
          mobile: "9999999999",
        },
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("PATCH denied for non-admin role", async () => {
    mockedVerifyToken.mockReturnValue(teacherPayload);

    const response = await request(app)
      .patch("/api/v1/students/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token")
      .send({ fullName: "Updated Student" });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("DELETE denied for non-admin role", async () => {
    mockedVerifyToken.mockReturnValue(teacherPayload);

    const response = await request(app)
      .delete("/api/v1/students/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
