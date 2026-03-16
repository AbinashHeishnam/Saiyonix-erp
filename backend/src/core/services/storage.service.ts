import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import { storageConfig } from "../config/externalServices";
import { logger } from "../../utils/logger";
import { createS3Provider } from "./storage/providers/s3.provider";
import { createR2Provider } from "./storage/providers/r2.provider";
import { createMinioProvider } from "./storage/providers/minio.provider";

export type UploadFileInput = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  folder?: string;
};

export type UploadFileResult = {
  fileUrl: string;
  fileKey: string;
};

type StorageProvider = {
  upload: (payload: UploadFileInput) => Promise<UploadFileResult>;
  remove: (fileKey: string) => Promise<void>;
};

const localRoot = path.join(process.cwd(), "uploads");

function resolveProvider(): StorageProvider {
  if (!storageConfig.enabled) {
    return createLocalProvider();
  }

  const provider = storageConfig.provider?.toLowerCase();
  if (provider === "s3") {
    return createS3Provider(storageConfig);
  }

  if (provider === "r2") {
    return createR2Provider(storageConfig);
  }

  if (provider === "minio") {
    return createMinioProvider(storageConfig);
  }

  logger.info("Storage provider not configured or unsupported; using local disk");
  return createLocalProvider();
}

function buildLocalPath(fileKey: string) {
  return path.join(localRoot, fileKey);
}

function createLocalProvider(): StorageProvider {
  async function upload(payload: UploadFileInput): Promise<UploadFileResult> {
    const safeName = payload.fileName.replace(/\s+/g, "-");
    const uniqueName = `${crypto.randomUUID()}-${safeName}`;
    const fileKey = payload.folder ? path.join(payload.folder, uniqueName) : uniqueName;
    const fullPath = buildLocalPath(fileKey);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, payload.buffer);

    return {
      fileUrl: `/uploads/${fileKey.replace(/\\/g, "/")}`,
      fileKey: fileKey.replace(/\\/g, "/"),
    };
  }

  async function remove(fileKey: string) {
    const fullPath = buildLocalPath(fileKey);
    await fs.unlink(fullPath);
  }

  return { upload, remove };
}

export const StorageService = {
  async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    const provider = resolveProvider();
    return provider.upload(input);
  },

  async deleteFile(fileKeyOrUrl: string): Promise<void> {
    const provider = resolveProvider();
    let fileKey = fileKeyOrUrl;
    if (fileKeyOrUrl.startsWith("http")) {
      try {
        const parsed = new URL(fileKeyOrUrl);
        fileKey = parsed.pathname.replace(/^\//, "");
        if (storageConfig.bucket && fileKey.startsWith(`${storageConfig.bucket}/`)) {
          fileKey = fileKey.slice(storageConfig.bucket.length + 1);
        }
      } catch {
        fileKey = fileKeyOrUrl;
      }
    }

    if (fileKey.includes("/uploads/")) {
      fileKey = fileKey.replace(/^.*\/uploads\//, "");
    }
    await provider.remove(fileKey);
  },
};
