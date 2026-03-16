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

const adminPayload = {
  sub: "user-1",
  email: "admin@saiyonix.test",
  roleId: "role-1",
  roleType: "ADMIN",
  schoolId: "school-1",
};

describe("circular routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifyToken.mockReturnValue(adminPayload);
    mockedRoleHasPermission.mockResolvedValue(true);

    mockedPrisma.$transaction.mockImplementation(async (input) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }
      return input(mockedPrisma as never);
    });
  });

  it("POST /circulars creates a circular", async () => {
    mockedPrisma.circular.create.mockResolvedValue({ id: "circ-1" } as never);

    const response = await request(app)
      .post("/api/v1/circulars")
      .set("Authorization", "Bearer valid-token")
      .send({
        title: "Exam Circular",
        body: "Details",
        targetType: "ALL",
      });

    expect(response.status).toBe(201);
    expect(response.body?.success).toBe(true);
  });

  it("GET /circulars lists circulars", async () => {
    mockedPrisma.circular.findMany.mockResolvedValue([] as never);
    mockedPrisma.circular.count.mockResolvedValue(0 as never);

    const response = await request(app)
      .get("/api/v1/circulars")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
  });

  it("GET /circulars/:id returns a circular", async () => {
    mockedPrisma.circular.findFirst.mockResolvedValue({ id: "circ-1" } as never);

    const response = await request(app)
      .get("/api/v1/circulars/ckl8i7y5h0000qz1x0ud1x9k2")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body?.data).toMatchObject({ id: "circ-1" });
  });

  it("PATCH /circulars/:id updates a circular", async () => {
    mockedPrisma.circular.findFirst.mockResolvedValue({ id: "circ-1" } as never);
    mockedPrisma.circular.update.mockResolvedValue({ id: "circ-1" } as never);

    const response = await request(app)
      .patch("/api/v1/circulars/ckl8i7y5h0000qz1x0ud1x9k2")
      .set("Authorization", "Bearer valid-token")
      .send({
        title: "Updated",
        targetType: "ALL",
      });

    expect(response.status).toBe(200);
    expect(response.body?.data).toMatchObject({ id: "circ-1" });
  });

  it("DELETE /circulars/:id deletes a circular", async () => {
    mockedPrisma.circular.findFirst.mockResolvedValue({ id: "circ-1" } as never);
    mockedPrisma.circular.delete.mockResolvedValue({ id: "circ-1" } as never);

    const response = await request(app)
      .delete("/api/v1/circulars/ckl8i7y5h0000qz1x0ud1x9k2")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body?.data).toMatchObject({ id: "ckl8i7y5h0000qz1x0ud1x9k2" });
  });
});
