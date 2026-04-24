import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendRoot = path.resolve(__dirname, "..");
const firebasePkgDir = path.join(frontendRoot, "node_modules", "firebase");
const publicFirebaseDir = path.join(frontendRoot, "public", "firebase");

const filesToCopy = ["firebase-app-compat.js", "firebase-messaging-compat.js"];

async function main() {
  await fs.mkdir(publicFirebaseDir, { recursive: true });

  await Promise.all(
    filesToCopy.map(async (file) => {
      const src = path.join(firebasePkgDir, file);
      const dst = path.join(publicFirebaseDir, file);
      await fs.copyFile(src, dst);
    })
  );

  // eslint-disable-next-line no-console
  console.info(`[FCM] Copied Firebase SW deps to ${path.relative(frontendRoot, publicFirebaseDir)}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[FCM] Failed to copy Firebase SW deps", err);
  process.exitCode = 1;
});

