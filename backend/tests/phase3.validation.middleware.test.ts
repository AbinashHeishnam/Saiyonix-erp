import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { validate } from "../src/middleware/validate.middleware";

describe("phase3 validation middleware", () => {
  it("rejects unknown fields in request body", async () => {
    const schema = z.object({ name: z.string() });
    const req = { body: { name: "SaiyoniX", extra: "nope" } } as any;
    const next = vi.fn();

    validate(schema)(req as any, {} as any, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0]?.[0];
    expect(error?.message).toBe("Validation failed");
    expect(error?.details?.errors?.[0]?.unknownKeys).toContain("extra");
  });
});
