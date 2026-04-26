import { logger } from "@/utils/logger";
let configuredProvider = null;
let warnedOnce = false;
export function setPushProvider(provider) {
    configuredProvider = provider;
}
export async function sendPush(payload) {
    if (!configuredProvider) {
        if (!warnedOnce) {
            warnedOnce = true;
            // Keep system functional if no provider is configured.
            logger.warn("[PUSH] Provider not configured. Push delivery skipped.");
        }
        return;
    }
    await configuredProvider.send(payload);
}
