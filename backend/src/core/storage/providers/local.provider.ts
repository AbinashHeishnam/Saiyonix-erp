import fs from "node:fs/promises";
import path from "node:path";

import type { StorageProvider, StorageUploadOptions, StorageUploadResult } from "@/core/storage/types";
import { buildStoredFileName, getStoragePath } from "@/core/storage/storagePath";

export class LocalStorageProvider implements StorageProvider {
  async upload(buffer: Buffer, options: StorageUploadOptions): Promise<StorageUploadResult> {
    const { folder, relativeUrl } = getStoragePath({
      userType: options.userType,
      userId: options.userId,
      module: options.module,
    });

    await fs.mkdir(folder, { recursive: true });

    const fileName = buildStoredFileName(options.fileName);
    const filePath = path.join(folder, fileName);
    await fs.writeFile(filePath, buffer);

    return {
      fileUrl: `${relativeUrl}/${fileName}`.replace(/\\/g, "/"),
      filePath,
      fileName,
      mimeType: options.mimeType,
      size: options.size,
    };
  }

  async delete(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  }
}
