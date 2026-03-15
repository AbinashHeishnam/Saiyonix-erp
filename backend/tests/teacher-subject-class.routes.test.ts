import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../src/config/prisma", () => ({
  default: {
    teacher: { findFirst: vi.fn() },
    classSubject: { findFirst: vi.fn() },
    section: { findFirst: vi.fn() },
    academicYear: { findFirst: vi.fn() },
    teacherSubjectClass: {
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

vi.mock("../src/utils/jwt", () => ({
  verifyToken: vi.fn(),
  signToken: vi.fn(),
}));

vi.mock("../src/modules/auth/permission.service", () => ({
  roleHasPermission: vi.fn(),
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

describe("teacher subject class routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifyToken.mockReturnValue(adminPayload);
    mockedRoleHasPermission.mockResolvedValue(true);

    mockedPrisma.teacher.findFirst.mockResolvedValue({ id: "teacher-1" } as never);
    mockedPrisma.classSubject.findFirst.mockResolvedValue({
      id: "class-subject-1",
      classId: "class-1",
      class: { academicYearId: "44444444-4444-4444-8444-444444444444" },
    } as never);
    mockedPrisma.section.findFirst.mockResolvedValue({
      id: "section-1",
      classId: "class-1",
    } as never);
    mockedPrisma.academicYear.findFirst.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
    } as never);
    mockedPrisma.$transaction.mockImplementation(async (input) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }
      return input(mockedPrisma as never);
    });
  });

  it("POST /teacher-subject-classes success", async () => {
    mockedPrisma.teacherSubjectClass.create.mockResolvedValue({
      id: "tsc-1",
      teacherId: "teacher-1",
      classSubjectId: "class-subject-1",
      sectionId: "section-1",
      academicYearId: "ay-1",
    } as never);

    const response = await request(app)
      .post("/api/v1/teacher-subject-classes")
      .set("Authorization", "Bearer valid-token")
      .send({
        teacherId: "11111111-1111-1111-8111-111111111111",
        classSubjectId: "22222222-2222-2222-8222-222222222222",
        sectionId: "33333333-3333-3333-8333-333333333333",
        academicYearId: "44444444-4444-4444-8444-444444444444",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("POST /teacher-subject-classes returns 409 on duplicate", async () => {
    mockedPrisma.teacherSubjectClass.create.mockRejectedValue({ code: "P2002" } as never);

    const response = await request(app)
      .post("/api/v1/teacher-subject-classes")
      .set("Authorization", "Bearer valid-token")
      .send({
        teacherId: "11111111-1111-1111-8111-111111111111",
        classSubjectId: "22222222-2222-2222-8222-222222222222",
        sectionId: "33333333-3333-3333-8333-333333333333",
        academicYearId: "44444444-4444-4444-8444-444444444444",
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("GET /teacher-subject-classes list", async () => {
    mockedPrisma.teacherSubjectClass.findMany.mockResolvedValue([] as never);
    mockedPrisma.teacherSubjectClass.count.mockResolvedValue(0 as never);
    mockedPrisma.$transaction.mockResolvedValue([[], 0] as never);

    const response = await request(app)
      .get("/api/v1/teacher-subject-classes")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("GET /teacher-subject-classes/:id", async () => {
    mockedPrisma.teacherSubjectClass.findFirst.mockResolvedValue({ id: "tsc-1" } as never);

    const response = await request(app)
      .get("/api/v1/teacher-subject-classes/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("PATCH /teacher-subject-classes/:id", async () => {
    mockedPrisma.teacherSubjectClass.findFirst.mockResolvedValue({
      id: "tsc-1",
      academicYearId: "44444444-4444-4444-8444-444444444444",
      classSubject: { classId: "class-1", class: { academicYearId: "44444444-4444-4444-8444-444444444444" } },
    } as never);
    mockedPrisma.teacherSubjectClass.update.mockResolvedValue({ id: "tsc-1" } as never);

    const response = await request(app)
      .patch("/api/v1/teacher-subject-classes/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token")
      .send({
        sectionId: null,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("DELETE /teacher-subject-classes/:id", async () => {
    mockedPrisma.teacherSubjectClass.findFirst.mockResolvedValue({ id: "tsc-1" } as never);
    mockedPrisma.teacherSubjectClass.delete.mockResolvedValue({ id: "tsc-1" } as never);

    const response = await request(app)
      .delete("/api/v1/teacher-subject-classes/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("POST denied for non-admin role", async () => {
    mockedVerifyToken.mockReturnValue(teacherPayload);

    const response = await request(app)
      .post("/api/v1/teacher-subject-classes")
      .set("Authorization", "Bearer valid-token")
      .send({
        teacherId: "11111111-1111-1111-8111-111111111111",
        classSubjectId: "22222222-2222-2222-8222-222222222222",
        academicYearId: "44444444-4444-4444-8444-444444444444",
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("PATCH denied for non-admin role", async () => {
    mockedVerifyToken.mockReturnValue(teacherPayload);

    const response = await request(app)
      .patch("/api/v1/teacher-subject-classes/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token")
      .send({
        sectionId: null,
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("DELETE denied for non-admin role", async () => {
    mockedVerifyToken.mockReturnValue(teacherPayload);

    const response = await request(app)
      .delete("/api/v1/teacher-subject-classes/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
