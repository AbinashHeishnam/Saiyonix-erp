import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";

import { ApiError } from "@/core/errors/apiError";
import { logger } from "@/utils/logger";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
};

let r2Client: S3Client | null = null;

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      process.env.R2_BUCKET_NAME?.trim() &&
      process.env.R2_ENDPOINT?.trim()
  );
}

function resolveR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();
  const endpoint = process.env.R2_ENDPOINT?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
    throw new ApiError(500, "R2 storage is not configured");
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, endpoint };
}

function getR2Client(config: R2Config) {
  if (r2Client) return r2Client;
  r2Client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return r2Client;
}

export function buildR2FileUrl(bucket: string, key: string) {
  return `r2://${bucket}/${key}`;
}

export async function uploadFile(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<{
  key: string;
  bucket: string;
  contentType: string;
  endpoint: string;
}> {
  const config = resolveR2Config();
  const client = getR2Client(config);

  const key = fileName;
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      })
    );
    logger.info(`[R2] upload success key=${key} bucket=${config.bucketName}`);
    return {
      key,
      bucket: config.bucketName,
      contentType,
      endpoint: config.endpoint,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[R2] upload failed key=${key} message=${message}`);
    throw new ApiError(502, "R2 upload failed");
  }
}

export async function downloadFile(key: string): Promise<{
  stream: Readable;
  contentType: string | null;
  contentLength: number | null;
  eTag: string | null;
}> {
  const config = resolveR2Config();
  const client = getR2Client(config);

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      })
    );

    const body = response.Body as Readable | undefined;
    if (!body) {
      throw new ApiError(404, "File not found");
    }

    return {
      stream: body,
      contentType: response.ContentType ?? null,
      contentLength: typeof response.ContentLength === "number" ? response.ContentLength : null,
      eTag: response.ETag ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[R2] download failed key=${key} message=${message}`);
    throw new ApiError(404, "File not found");
  }
}

export async function deleteFile(key: string): Promise<void> {
  const config = resolveR2Config();
  const client = getR2Client(config);

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      })
    );
    logger.info(`[R2] delete success key=${key} bucket=${config.bucketName}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[R2] delete failed key=${key} message=${message}`);
    throw new ApiError(502, "R2 delete failed");
  }
}
