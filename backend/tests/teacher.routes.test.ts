import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../src/config/prisma", () => ({
  default: {
    teacher: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
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

describe("teacher routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifyToken.mockReturnValue(adminPayload);
    mockedRoleHasPermission.mockResolvedValue(true);
  });

  it("POST /teachers success", async () => {
    mockedPrisma.teacher.create.mockResolvedValue({
      id: "teacher-1",
      schoolId: "school-1",
      employeeId: "EMP-001",
      fullName: "Alice Teacher",
      designation: "TGT",
      department: "Math",
      joiningDate: new Date("2024-06-01"),
    } as never);

    const response = await request(app)
      .post("/api/v1/teachers")
      .set("Authorization", "Bearer valid-token")
      .send({
        employeeId: "EMP-001",
        fullName: "Alice Teacher",
        designation: "TGT",
        department: "Math",
        joiningDate: "2024-06-01",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("POST /teachers returns 409 on duplicate employeeId", async () => {
    mockedPrisma.teacher.create.mockRejectedValue({ code: "P2002" } as never);

    const response = await request(app)
      .post("/api/v1/teachers")
      .set("Authorization", "Bearer valid-token")
      .send({
        employeeId: "EMP-001",
        fullName: "Alice Teacher",
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("GET /teachers returns teachers for the same school", async () => {
    mockedPrisma.teacher.findMany.mockResolvedValue([
      {
        id: "teacher-1",
        schoolId: "school-1",
        employeeId: "EMP-001",
        fullName: "Alice Teacher",
        deletedAt: null,
      },
    ] as never);
    mockedPrisma.teacher.count.mockResolvedValue(1 as never);
    mockedPrisma.$transaction.mockResolvedValue([[{}], 1] as never);

    const response = await request(app)
      .get("/api/v1/teachers")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(mockedPrisma.teacher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "school-1",
        }),
      })
    );
  });

  it("GET /teachers/:id returns 404 when not found", async () => {
    mockedPrisma.teacher.findFirst.mockResolvedValue(null as never);

    const response = await request(app)
      .get("/api/v1/teachers/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("POST /teachers denied for non-admin role", async () => {
    mockedVerifyToken.mockReturnValue(teacherPayload);

    const response = await request(app)
      .post("/api/v1/teachers")
      .set("Authorization", "Bearer valid-token")
      .send({
        employeeId: "EMP-002",
        fullName: "Bob Teacher",
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("PATCH /teachers/:id denied for non-admin role", async () => {
    mockedVerifyToken.mockReturnValue(teacherPayload);

    const response = await request(app)
      .patch("/api/v1/teachers/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token")
      .send({
        fullName: "Updated Name",
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("DELETE /teachers/:id denied for non-admin role", async () => {
    mockedVerifyToken.mockReturnValue(teacherPayload);

    const response = await request(app)
      .delete("/api/v1/teachers/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
