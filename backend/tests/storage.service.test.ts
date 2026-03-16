import fs from "fs/promises";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

function setBaseEnv() {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/test";
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-12345";
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("storage.service", () => {
  it("falls back to local storage when keys are missing", async () => {
    setBaseEnv();
    delete process.env.STORAGE_PROVIDER;
    delete process.env.STORAGE_BUCKET;
    delete process.env.STORAGE_ACCESS_KEY;
    delete process.env.STORAGE_SECRET_KEY;

    const { StorageService } = await import("../src/core/services/storage.service");

    const result = await StorageService.uploadFile({
      buffer: Buffer.from("hello"),
      fileName: "test.txt",
      mimeType: "text/plain",
      folder: "tests",
    });

    expect(result.fileUrl).toContain("/uploads/");

    const fullPath = path.join(process.cwd(), "uploads", result.fileKey);
    expect(await fileExists(fullPath)).toBe(true);

    await StorageService.deleteFile(result.fileKey);
    expect(await fileExists(fullPath)).toBe(false);
  });
});
