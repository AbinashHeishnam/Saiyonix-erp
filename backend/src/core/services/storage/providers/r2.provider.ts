import { PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { StorageConfig } from "../../../config/externalServices";
import type { StorageUploadPayload, StorageUploadResult } from "./s3.provider";

function buildFileKey(payload: StorageUploadPayload) {
  const safeName = payload.fileName.replace(/\s+/g, "-");
  return payload.folder ? `${payload.folder}/${safeName}` : safeName;
}

function resolveEndpoint(config: StorageConfig) {
  if (!config.region) {
    return undefined;
  }
  return config.region.startsWith("http") ? config.region : `https://${config.region}`;
}

export function createR2Provider(config: StorageConfig) {
  const endpoint = resolveEndpoint(config);
  const client = new S3Client({
    region: "auto",
    endpoint,
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

    const baseUrl = endpoint ?? "";
    const fileUrl = baseUrl ? `${baseUrl}/${fileKey}` : fileKey;
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
