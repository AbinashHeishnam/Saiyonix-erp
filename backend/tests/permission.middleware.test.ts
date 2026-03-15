import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/modules/auth/permission.service", () => ({
  roleHasPermission: vi.fn(),
}));

import { requirePermission } from "../src/middleware/permission.middleware";
import { roleHasPermission } from "../src/modules/auth/permission.service";

const mockedRoleHasPermission = vi.mocked(roleHasPermission);

function createMockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("permission middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows request when role permission exists", async () => {
    mockedRoleHasPermission.mockResolvedValue(true);

    const req = {
      user: { roleId: "role-1" },
    } as { user?: { roleId: string } };

    const res = createMockRes();
    const next = vi.fn();

    await requirePermission("student:read")(req as never, res as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects request when role permission is missing", async () => {
    mockedRoleHasPermission.mockResolvedValue(false);

    const req = {
      user: { roleId: "role-1" },
    } as { user?: { roleId: string } };

    const res = createMockRes();
    const next = vi.fn();

    await requirePermission("student:read")(req as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
      })
    );
  });
});
