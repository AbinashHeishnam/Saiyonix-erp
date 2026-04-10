import path from "node:path";

import prisma from "@/core/db/prisma";
import { ApiError } from "@/core/errors/apiError";
import type { StorageUploadOptions, StorageUploadResult } from "@/core/storage/types";
import { ALLOWED_FILE_TYPES } from "@/core/storage/constants";
import { logSecurity } from "@/core/security/logger";
import { buildStoredFileName, getStoragePath } from "@/core/storage/storagePath";
import { uploadFile as uploadR2File, buildR2FileUrl, isR2Configured, deleteFile as deleteR2File } from "@/services/storage/r2.service";

function ensureAllowedType(mimeType: string, fileName: string) {
  const allowedMime = new Set(ALLOWED_FILE_TYPES.mime);
  const ext = path.extname(fileName).toLowerCase();
  const allowedExt = new Set(ALLOWED_FILE_TYPES.ext);
  if (!allowedMime.has(mimeType) || !allowedExt.has(ext)) {
    logSecurity("blocked_file_type", { mimeType });
    throw new ApiError(400, "File type not allowed");
  }
}

export async function uploadFile(
  buffer: Buffer,
  options: StorageUploadOptions
): Promise<StorageUploadResult> {
  ensureAllowedType(options.mimeType, options.fileName);

  if (!isR2Configured()) {
    throw new ApiError(500, "R2 storage is not configured");
  }

  const storedFileName = buildStoredFileName(options.fileName);
  const { relativeUrl } = getStoragePath({
    userType: options.userType,
    userId: options.userId,
    module: options.module,
  });
  const keyPrefix = relativeUrl.replace(/^\/storage\//, "");
  const key = path.posix.join(keyPrefix, storedFileName);
  const result = await uploadR2File(buffer, key, options.mimeType);

  const fileMetaClient = (prisma as typeof prisma & { fileMeta?: { create: (args: any) => Promise<any> } }).fileMeta;
  if (!fileMetaClient?.create) {
    // If Prisma client was generated without FileMeta model, avoid crashing uploads.
    console.warn("[storage] FileMeta model is missing on Prisma client; skipping fileMeta.create");
    return {
      fileUrl: buildR2FileUrl(result.bucket, result.key),
      filePath: result.key,
      fileName: storedFileName,
      mimeType: options.mimeType,
      size: options.size,
    };
  }

  const uploadResult: StorageUploadResult = {
    fileUrl: buildR2FileUrl(result.bucket, result.key),
    filePath: result.key,
    fileName: storedFileName,
    mimeType: options.mimeType,
    size: options.size,
  };

  await fileMetaClient.create({
    data: {
      userId: options.userId ?? null,
      userType: options.userType,
      module: options.module,
      fileName: uploadResult.fileName,
      fileUrl: uploadResult.fileUrl,
      mimeType: uploadResult.mimeType,
      size: options.size ?? null,
    },
  });

  return uploadResult;
}

export async function deleteFile(fileUrl: string) {
  const fileMeta = await prisma.fileMeta.findFirst({
    where: { fileUrl },
  });

  if (fileUrl.startsWith("r2://")) {
    const withoutScheme = fileUrl.slice("r2://".length);
    const [bucket, ...rest] = withoutScheme.split("/");
    const key = rest.join("/");
    if (!bucket || !key) {
      throw new ApiError(400, "Invalid file url");
    }
    if (bucket !== process.env.R2_BUCKET_NAME) {
      throw new ApiError(400, "Invalid file url");
    }
    await deleteR2File(key);
    if (fileMeta) {
      await prisma.fileMeta.delete({ where: { id: fileMeta.id } });
    }
    return;
  }

  if (!fileMeta) {
    throw new ApiError(404, "File not found");
  }

  const filePath = fileMeta.fileUrl.startsWith("/storage")
    ? path.join(process.cwd(), fileMeta.fileUrl.replace(/^\/storage\//, "storage/"))
    : fileMeta.fileUrl;
  const fs = await import("node:fs/promises");
  await fs.unlink(filePath);

  await prisma.fileMeta.delete({ where: { id: fileMeta.id } });
}
