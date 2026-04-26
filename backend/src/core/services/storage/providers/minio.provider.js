import { PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
function buildFileKey(payload) {
    const safeName = payload.fileName.replace(/\s+/g, "-");
    return payload.folder ? `${payload.folder}/${safeName}` : safeName;
}
function resolveEndpoint(config) {
    if (!config.region) {
        return undefined;
    }
    return config.region.startsWith("http") ? config.region : `https://${config.region}`;
}
export function createMinioProvider(config) {
    const endpoint = resolveEndpoint(config);
    const client = new S3Client({
        region: "us-east-1",
        endpoint,
        forcePathStyle: true,
        credentials: {
            accessKeyId: config.accessKey,
            secretAccessKey: config.secretKey,
        },
    });
    async function upload(payload) {
        const fileKey = buildFileKey(payload);
        await client.send(new PutObjectCommand({
            Bucket: config.bucket,
            Key: fileKey,
            Body: payload.buffer,
            ContentType: payload.mimeType,
        }));
        const baseUrl = endpoint ?? "";
        const fileUrl = baseUrl ? `${baseUrl}/${config.bucket}/${fileKey}` : fileKey;
        return { fileUrl, fileKey };
    }
    async function remove(fileKey) {
        await client.send(new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: fileKey,
        }));
    }
    return { upload, remove };
}
