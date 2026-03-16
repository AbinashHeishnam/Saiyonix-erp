import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma } from "./helpers/mockPrisma";

vi.mock("../src/config/prisma", () => ({
  default: createMockPrisma(),
}));

import prisma from "../src/config/prisma";
import { listNotices } from "../src/modules/noticeBoard/service";

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

describe("notice targeting flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTransaction();
  });

  it("returns notices only for the targeted section", async () => {
    mockedPrisma.noticeBoard.findMany
      .mockResolvedValueOnce([{ id: "notice-1" }] as never)
      .mockResolvedValueOnce([] as never);
    mockedPrisma.noticeBoard.count
      .mockResolvedValueOnce(1 as never)
      .mockResolvedValueOnce(0 as never);

    const inSection = await listNotices(
      schoolId,
      { sectionId: "section-1" },
      { skip: 0, take: 20 }
    );

    const outSection = await listNotices(
      schoolId,
      { sectionId: "section-2" },
      { skip: 0, take: 20 }
    );

    expect(inSection.items).toHaveLength(1);
    expect(outSection.items).toHaveLength(0);

    expect(mockedPrisma.noticeBoard.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              targetType: "SECTION",
              targetSectionId: "section-1",
            }),
          ]),
        }),
      })
    );

    expect(mockedPrisma.noticeBoard.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              targetType: "SECTION",
              targetSectionId: "section-2",
            }),
          ]),
        }),
      })
    );
  });
});
