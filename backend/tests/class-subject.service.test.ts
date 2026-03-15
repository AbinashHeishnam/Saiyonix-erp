import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/prisma", () => ({
  default: {
    class: {
      findFirst: vi.fn(),
    },
    subject: {
      findFirst: vi.fn(),
    },
    classSubject: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import prisma from "../src/config/prisma";
import {
  createClassSubject,
  getClassSubjectById,
  listClassSubjects,
} from "../src/modules/classSubject/service";

const mockedPrisma = vi.mocked(prisma, true);

describe("classSubject.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedPrisma.class.findFirst.mockResolvedValue({ id: "class-1" } as never);
    mockedPrisma.subject.findFirst.mockResolvedValue({ id: "subject-1" } as never);
  });

  it("maps duplicate class-subject create to 409 conflict", async () => {
    mockedPrisma.classSubject.create.mockRejectedValue({ code: "P2002" } as never);

    await expect(
      createClassSubject("school-1", {
        classId: "11111111-1111-1111-1111-111111111111",
        subjectId: "22222222-2222-2222-2222-222222222222",
        periodsPerWeek: 5,
      })
    ).rejects.toMatchObject({
      status: 409,
      message: "Subject is already mapped to this class",
    });
  });

  it("enforces school-scoped lookup for class subject by id", async () => {
    mockedPrisma.classSubject.findFirst.mockResolvedValue(null as never);

    await expect(
      getClassSubjectById("school-1", "33333333-3333-3333-3333-333333333333")
    ).rejects.toMatchObject({
      status: 404,
      message: "Class subject mapping not found",
    });

    expect(mockedPrisma.classSubject.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          class: expect.objectContaining({ schoolId: "school-1" }),
          subject: expect.objectContaining({ schoolId: "school-1" }),
        }),
      })
    );
  });

  it("lists class subjects filtered by logged-in user's school", async () => {
    mockedPrisma.classSubject.findMany.mockResolvedValue([] as never);
    mockedPrisma.classSubject.count.mockResolvedValue(0 as never);
    mockedPrisma.$transaction.mockResolvedValue([[], 0] as never);

    await listClassSubjects("school-1");

    expect(mockedPrisma.classSubject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          class: expect.objectContaining({ schoolId: "school-1" }),
          subject: expect.objectContaining({ schoolId: "school-1" }),
        }),
      })
    );
  });
});
