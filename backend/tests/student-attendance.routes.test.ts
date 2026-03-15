import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

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

describe("student attendance routes", () => {
  const ids = {
    sectionId: "11111111-1111-1111-8111-111111111111",
    academicYearId: "22222222-2222-2222-8222-222222222222",
    timetableSlotId: "33333333-3333-3333-8333-333333333333",
    teacherId: "44444444-4444-4444-8444-444444444444",
    studentId: "55555555-5555-5555-8555-555555555555",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifyToken.mockReturnValue(adminPayload);
    mockedRoleHasPermission.mockResolvedValue(true);

    mockedPrisma.academicYear.findFirst.mockResolvedValue({
      id: ids.academicYearId,
    } as never);
    mockedPrisma.section.findFirst.mockResolvedValue({
      id: ids.sectionId,
      classTeacherId: ids.teacherId,
    } as never);
    mockedPrisma.timetableSlot.findFirst.mockResolvedValue({
      id: ids.timetableSlotId,
    } as never);
    mockedPrisma.teacher.findFirst.mockResolvedValue({ id: ids.teacherId } as never);
    mockedPrisma.studentEnrollment.findMany.mockResolvedValue([
      { studentId: ids.studentId },
    ] as never);
    mockedPrisma.studentAttendance.findMany.mockResolvedValue([] as never);

    mockedPrisma.$transaction.mockImplementation(async (input) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }
      return input(mockedPrisma as never);
    });
  });

  it("POST /student-attendance success", async () => {
    mockedPrisma.studentAttendance.create.mockResolvedValue({ id: "att-1" } as never);

    const response = await request(app)
      .post("/api/v1/student-attendance")
      .set("Authorization", "Bearer valid-token")
      .send({
        sectionId: ids.sectionId,
        academicYearId: ids.academicYearId,
        timetableSlotId: ids.timetableSlotId,
        markedByTeacherId: ids.teacherId,
        records: [{ studentId: ids.studentId, status: "PRESENT" }],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("POST /student-attendance returns 409 on duplicate", async () => {
    mockedPrisma.studentAttendance.findMany.mockResolvedValueOnce([
      { studentId: "student-1" },
    ] as never);

    const response = await request(app)
      .post("/api/v1/student-attendance")
      .set("Authorization", "Bearer valid-token")
      .send({
        sectionId: ids.sectionId,
        academicYearId: ids.academicYearId,
        timetableSlotId: ids.timetableSlotId,
        markedByTeacherId: ids.teacherId,
        records: [{ studentId: ids.studentId, status: "PRESENT" }],
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("GET /student-attendance list", async () => {
    mockedPrisma.studentAttendance.findMany.mockResolvedValue([] as never);
    mockedPrisma.studentAttendance.count.mockResolvedValue(0 as never);
    mockedPrisma.$transaction.mockResolvedValue([[], 0] as never);

    const response = await request(app)
      .get("/api/v1/student-attendance")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("GET /student-attendance/:id", async () => {
    mockedPrisma.studentAttendance.findFirst.mockResolvedValue({ id: "att-1" } as never);

    const response = await request(app)
      .get("/api/v1/student-attendance/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("PATCH /student-attendance/:id", async () => {
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

    const response = await request(app)
      .patch("/api/v1/student-attendance/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "ABSENT", correctionReason: "Correction" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
