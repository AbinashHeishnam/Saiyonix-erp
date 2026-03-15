import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

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

const ids = {
  sectionId: "11111111-1111-1111-8111-111111111111",
  classSubjectId: "22222222-2222-2222-8222-222222222222",
  teacherId: "33333333-3333-3333-8333-333333333333",
  academicYearId: "44444444-4444-4444-8444-444444444444",
  periodId: "55555555-5555-5555-8555-555555555555",
};

describe("timetable slot routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifyToken.mockReturnValue(adminPayload);
    mockedRoleHasPermission.mockResolvedValue(true);

    mockedPrisma.academicYear.findFirst.mockResolvedValue({ id: ids.academicYearId } as never);
    mockedPrisma.teacher.findFirst.mockResolvedValue({ id: ids.teacherId } as never);
    mockedPrisma.period.findFirst.mockResolvedValue({ id: ids.periodId } as never);
    mockedPrisma.section.findFirst.mockResolvedValue({
      id: ids.sectionId,
      classId: "class-1",
    } as never);
    mockedPrisma.classSubject.findFirst.mockResolvedValue({
      id: ids.classSubjectId,
      classId: "class-1",
      class: { academicYearId: ids.academicYearId },
    } as never);
    mockedPrisma.teacherSubjectClass.findFirst.mockResolvedValue({ id: "tsc-1" } as never);
    mockedPrisma.$transaction.mockImplementation(async (input) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }
      return input(mockedPrisma as never);
    });
  });

  it("POST /timetable-slots success", async () => {
    mockedPrisma.timetableSlot.findFirst.mockResolvedValueOnce(null as never);
    mockedPrisma.timetableSlot.findFirst.mockResolvedValueOnce(null as never);
    mockedPrisma.timetableSlot.create.mockResolvedValue({ id: "slot-1" } as never);

    const response = await request(app)
      .post("/api/v1/timetable-slots")
      .set("Authorization", "Bearer valid-token")
      .send({
        sectionId: "11111111-1111-1111-8111-111111111111",
        classSubjectId: "22222222-2222-2222-8222-222222222222",
        teacherId: "33333333-3333-3333-8333-333333333333",
        academicYearId: "44444444-4444-4444-8444-444444444444",
        dayOfWeek: 1,
        periodId: "55555555-5555-5555-8555-555555555555",
        roomNo: "R-101",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("POST /timetable-slots returns 409 on conflict", async () => {
    mockedPrisma.timetableSlot.findFirst.mockResolvedValueOnce({ id: "slot-1" } as never);

    const response = await request(app)
      .post("/api/v1/timetable-slots")
      .set("Authorization", "Bearer valid-token")
      .send({
        sectionId: "11111111-1111-1111-8111-111111111111",
        classSubjectId: "22222222-2222-2222-8222-222222222222",
        teacherId: "33333333-3333-3333-8333-333333333333",
        academicYearId: "44444444-4444-4444-8444-444444444444",
        dayOfWeek: 1,
        periodId: "55555555-5555-5555-8555-555555555555",
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("GET /timetable-slots list", async () => {
    mockedPrisma.timetableSlot.findMany.mockResolvedValue([] as never);
    mockedPrisma.timetableSlot.count.mockResolvedValue(0 as never);
    mockedPrisma.$transaction.mockResolvedValue([[], 0] as never);

    const response = await request(app)
      .get("/api/v1/timetable-slots")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("GET /timetable-slots/:id", async () => {
    mockedPrisma.timetableSlot.findFirst.mockResolvedValue({ id: "slot-1" } as never);

    const response = await request(app)
      .get("/api/v1/timetable-slots/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("PATCH /timetable-slots/:id", async () => {
    mockedPrisma.timetableSlot.findFirst.mockResolvedValueOnce({
      id: "slot-1",
      sectionId: ids.sectionId,
      classSubjectId: ids.classSubjectId,
      teacherId: ids.teacherId,
      academicYearId: ids.academicYearId,
      dayOfWeek: 1,
      periodId: ids.periodId,
    } as never);
    mockedPrisma.timetableSlot.findFirst.mockResolvedValueOnce(null as never);
    mockedPrisma.timetableSlot.findFirst.mockResolvedValueOnce(null as never);
    mockedPrisma.timetableSlot.update.mockResolvedValue({ id: "slot-1" } as never);

    const response = await request(app)
      .patch("/api/v1/timetable-slots/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token")
      .send({ roomNo: "R-202" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("DELETE /timetable-slots/:id", async () => {
    mockedPrisma.timetableSlot.findFirst.mockResolvedValue({ id: "slot-1" } as never);
    mockedPrisma.timetableSlot.delete.mockResolvedValue({ id: "slot-1" } as never);

    const response = await request(app)
      .delete("/api/v1/timetable-slots/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("POST denied for non-admin role", async () => {
    mockedVerifyToken.mockReturnValue(teacherPayload);

    const response = await request(app)
      .post("/api/v1/timetable-slots")
      .set("Authorization", "Bearer valid-token")
      .send({
        sectionId: "11111111-1111-1111-8111-111111111111",
        classSubjectId: "22222222-2222-2222-8222-222222222222",
        academicYearId: "44444444-4444-4444-8444-444444444444",
        dayOfWeek: 1,
        periodId: "55555555-5555-5555-8555-555555555555",
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("PATCH denied for non-admin role", async () => {
    mockedVerifyToken.mockReturnValue(teacherPayload);

    const response = await request(app)
      .patch("/api/v1/timetable-slots/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token")
      .send({ roomNo: "R-202" });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("DELETE denied for non-admin role", async () => {
    mockedVerifyToken.mockReturnValue(teacherPayload);

    const response = await request(app)
      .delete("/api/v1/timetable-slots/11111111-1111-1111-8111-111111111111")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
