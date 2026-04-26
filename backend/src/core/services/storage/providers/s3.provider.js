import { PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
function buildFileKey(payload) {
    const safeName = payload.fileName.replace(/\s+/g, "-");
    return payload.folder ? `${payload.folder}/${safeName}` : safeName;
}
export function createS3Provider(config) {
    const region = config.region || "ap-south-1";
    const client = new S3Client({
        region,
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
        const fileUrl = `https://${config.bucket}.s3.${region}.amazonaws.com/${fileKey}`;
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
