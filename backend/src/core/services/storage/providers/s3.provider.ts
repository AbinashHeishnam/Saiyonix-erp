import { PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { StorageConfig } from "@/core/config/externalServices";

export type StorageUploadPayload = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  folder?: string;
};

export type StorageUploadResult = {
  fileUrl: string;
  fileKey: string;
};

function buildFileKey(payload: StorageUploadPayload) {
  const safeName = payload.fileName.replace(/\s+/g, "-");
  return payload.folder ? `${payload.folder}/${safeName}` : safeName;
}

export function createS3Provider(config: StorageConfig) {
  const region = config.region || "ap-south-1";
  const client = new S3Client({
    region,
    credentials: {
      accessKeyId: config.accessKey as string,
      secretAccessKey: config.secretKey as string,
    },
  });

  async function upload(payload: StorageUploadPayload): Promise<StorageUploadResult> {
    const fileKey = buildFileKey(payload);

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: fileKey,
        Body: payload.buffer,
        ContentType: payload.mimeType,
      })
    );

    const fileUrl = `https://${config.bucket}.s3.${region}.amazonaws.com/${fileKey}`;
    return { fileUrl, fileKey };
  }

  async function remove(fileKey: string) {
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: fileKey,
      })
    );
  }

  return { upload, remove };
}
