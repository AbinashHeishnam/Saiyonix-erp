import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

import prisma from "../src/config/prisma";
import {
  createCircular,
  deleteCircular,
  getCircularById,
  listCirculars,
  updateCircular,
} from "../src/modules/circular/service";

const mockedPrisma = vi.mocked(prisma, true);

const schoolId = "school-1";

function setupTransaction() {
  mockedPrisma.$transaction.mockImplementation(async (input) => {
    if (Array.isArray(input)) {
      return Promise.all(input);
    }
    return input(mockedPrisma as never);
  });
}

describe("circular.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTransaction();
  });

  it("creates a circular", async () => {
    mockedPrisma.circular.create.mockResolvedValue({ id: "circ-1" } as never);

    const result = await createCircular(
      schoolId,
      {
        title: "Exam Circular",
        body: "Details",
        targetType: "ALL",
      },
      "user-1"
    );

    expect(result).toMatchObject({ id: "circ-1" });
    expect(mockedPrisma.circular.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId,
          title: "Exam Circular",
          body: "Details",
          targetType: "ALL",
        }),
      })
    );
  });

  it("filters scheduled and expired circulars", async () => {
    mockedPrisma.circular.findMany.mockResolvedValue([] as never);
    mockedPrisma.circular.count.mockResolvedValue(0 as never);

    await listCirculars(schoolId, {}, { skip: 0, take: 10 });

    expect(mockedPrisma.circular.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            { OR: [{ publishedAt: null }, { publishedAt: { lte: expect.any(Date) } }] },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }] },
          ],
        }),
      })
    );
  });

  it("applies role/class/section targeting", async () => {
    mockedPrisma.circular.findMany.mockResolvedValue([] as never);
    mockedPrisma.circular.count.mockResolvedValue(0 as never);

    await listCirculars(
      schoolId,
      { classId: "class-1", roleType: "TEACHER" },
      { skip: 0, take: 10 }
    );

    expect(mockedPrisma.circular.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { targetType: "ALL" },
            { targetType: "CLASS", targetClassId: "class-1" },
            { targetType: "ROLE", targetRole: "TEACHER" },
          ],
        }),
      })
    );
  });

  it("gets a circular by id", async () => {
    mockedPrisma.circular.findFirst.mockResolvedValue({ id: "circ-1" } as never);

    const result = await getCircularById(schoolId, "circ-1");

    expect(result).toMatchObject({ id: "circ-1" });
  });

  it("updates a circular", async () => {
    mockedPrisma.circular.findFirst.mockResolvedValue({ id: "circ-1" } as never);
    mockedPrisma.circular.update.mockResolvedValue({ id: "circ-1" } as never);

    const result = await updateCircular(schoolId, "circ-1", {
      title: "Updated",
    });

    expect(result).toMatchObject({ id: "circ-1" });
    expect(mockedPrisma.circular.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "circ-1" } })
    );
  });

  it("deletes a circular", async () => {
    mockedPrisma.circular.findFirst.mockResolvedValue({ id: "circ-1" } as never);
    mockedPrisma.circular.delete.mockResolvedValue({ id: "circ-1" } as never);

    const result = await deleteCircular(schoolId, "circ-1");

    expect(result).toMatchObject({ id: "circ-1" });
    expect(mockedPrisma.circular.delete).toHaveBeenCalledWith({ where: { id: "circ-1" } });
  });
});
