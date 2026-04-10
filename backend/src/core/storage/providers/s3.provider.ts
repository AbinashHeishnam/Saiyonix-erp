import type { StorageProvider, StorageUploadOptions, StorageUploadResult } from "@/core/storage/types";

export class S3StorageProvider implements StorageProvider {
  async upload(_buffer: Buffer, _options: StorageUploadOptions): Promise<StorageUploadResult> {
    throw new Error("S3StorageProvider not implemented");
  }

  async delete(_filePath: string): Promise<void> {
    throw new Error("S3StorageProvider not implemented");
  }
}
