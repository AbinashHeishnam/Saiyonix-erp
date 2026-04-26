import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { uploadFile } from "@/services/storage/r2.service";
async function main() {
    const filePath = path.join(process.cwd(), "test.txt");
    const buffer = await fs.readFile(filePath);
    const result = await uploadFile(buffer, "test.txt", "text/plain");
    console.log("R2 upload result:", result);
}
main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("R2 upload failed:", message);
    process.exit(1);
});
