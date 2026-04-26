import fs from "node:fs/promises";
import path from "node:path";
import { buildStoredFileName, getStoragePath } from "@/core/storage/storagePath";
export class LocalStorageProvider {
    async upload(buffer, options) {
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
    async delete(filePath) {
        await fs.unlink(filePath);
    }
}
