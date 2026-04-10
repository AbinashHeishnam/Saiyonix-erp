export type StorageUploadOptions = {
  userType: "student" | "teacher" | "parent" | "common";
  userId?: string;
  module: string;
  fileName: string;
  mimeType: string;
  size?: number;
};

export type StorageUploadResult = {
  fileUrl: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  size?: number;
};

export interface StorageProvider {
  upload(buffer: Buffer, options: StorageUploadOptions): Promise<StorageUploadResult>;
  delete(filePath: string): Promise<void>;
}
