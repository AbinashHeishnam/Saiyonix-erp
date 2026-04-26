export class S3StorageProvider {
    async upload(_buffer, _options) {
        throw new Error("S3StorageProvider not implemented");
    }
    async delete(_filePath) {
        throw new Error("S3StorageProvider not implemented");
    }
}
