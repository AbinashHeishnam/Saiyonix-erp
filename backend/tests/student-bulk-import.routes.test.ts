import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";
import request from "supertest";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
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

const csvHeader =
  "fullName,dateOfBirth,gender,academicYearId,classId,sectionId,parentName,parentMobile";
const baseRow =
  "Student One,01/01/2010,Male,11111111-1111-1111-8111-111111111111,22222222-2222-2222-8222-222222222222,33333333-3333-3333-8333-333333333333,Parent One,9999999999";

function setupSuccessMocks() {
  mockedPrisma.school.findFirst.mockResolvedValue({ id: "school-1", code: "SCH" } as never);
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
        create: vi.fn().mockResolvedValue({ id: "enroll-1" }),
      },
    };
    return callback(tx as never);
  });
}

describe("student bulk import routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifyToken.mockReturnValue(adminPayload);
    mockedRoleHasPermission.mockResolvedValue(true);
    setupSuccessMocks();
  });

  it("POST /student-bulk-imports success", async () => {
    const csv = `${csvHeader}\n${baseRow}`;

    const response = await request(app)
      .post("/api/v1/student-bulk-imports")
      .set("Authorization", "Bearer valid-token")
      .set("Content-Type", "text/csv")
      .send(csv);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("POST /student-bulk-imports returns validation errors", async () => {
    const header = `${csvHeader},registrationNumber`;
    const row1 = `${baseRow},REG-001`;
    const row2 = `${baseRow.replace("Student One", "Student Two")},REG-001`;
    const csv = `${header}\n${row1}\n${row2}`;

    const response = await request(app)
      .post("/api/v1/student-bulk-imports")
      .set("Authorization", "Bearer valid-token")
      .set("Content-Type", "text/csv")
      .send(csv);

    expect(response.status).toBe(201);
    expect(response.body.data.failed).toBeGreaterThan(0);
  });

  it("POST /student-bulk-imports denied for non-admin role", async () => {
    mockedVerifyToken.mockReturnValue(teacherPayload);

    const csv = `${csvHeader}\n${baseRow}`;

    const response = await request(app)
      .post("/api/v1/student-bulk-imports")
      .set("Authorization", "Bearer valid-token")
      .set("Content-Type", "text/csv")
      .send(csv);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
