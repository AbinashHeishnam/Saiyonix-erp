import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";
import request from "supertest";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
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

describe("master-data routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRoleHasPermission.mockResolvedValue(true);

    mockedVerifyToken.mockReturnValue({
      sub: "user-1",
      email: "admin@saiyonix.test",
      roleId: "role-1",
      roleType: "ADMIN",
      schoolId: "school-1",
    });

    mockedPrisma.user.findUnique.mockResolvedValue({ schoolId: "school-1" } as never);
  });

  it("creates class successfully", async () => {
    mockedPrisma.academicYear.findFirst.mockResolvedValue({ id: "ay-1" } as never);
    mockedPrisma.class.create.mockResolvedValue({
      id: "class-1",
      schoolId: "school-1",
      academicYearId: "ay-1",
      className: "Grade 1",
      classOrder: 1,
      isHalfDay: false,
    } as never);

    const response = await request(app)
      .post("/api/v1/classes")
      .set("Authorization", "Bearer valid-token")
      .send({
        className: "Grade 1",
        classOrder: 1,
        academicYearId: "11111111-1111-1111-8111-111111111111",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(mockedPrisma.class.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "school-1",
          className: "Grade 1",
        }),
      })
    );
  });

  it("creates section successfully", async () => {
    mockedPrisma.class.findFirst.mockResolvedValue({ id: "class-1" } as never);
    mockedPrisma.section.create.mockResolvedValue({
      id: "section-1",
      classId: "class-1",
      sectionName: "A",
    } as never);

    const response = await request(app)
      .post("/api/v1/sections")
      .set("Authorization", "Bearer valid-token")
      .send({
        classId: "22222222-2222-2222-8222-222222222222",
        sectionName: "A",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(mockedPrisma.section.create).toHaveBeenCalled();
  });

  it("returns validation error for invalid class payload", async () => {
    const response = await request(app)
      .post("/api/v1/classes")
      .set("Authorization", "Bearer valid-token")
      .send({
        className: "",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });

  it("blocks non-admin role for create class", async () => {
    mockedVerifyToken.mockReturnValue({
      sub: "user-2",
      email: "teacher@saiyonix.test",
      roleId: "role-2",
      roleType: "TEACHER",
      schoolId: "school-1",
    });

    const response = await request(app)
      .post("/api/v1/classes")
      .set("Authorization", "Bearer valid-token")
      .send({
        className: "Grade 2",
        classOrder: 2,
        academicYearId: "33333333-3333-3333-8333-333333333333",
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Forbidden");
  });
});
