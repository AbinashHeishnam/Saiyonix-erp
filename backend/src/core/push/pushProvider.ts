import { logger } from "../../utils/logger";

export type PushPayload = {
  schoolId?: string;
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
};

export type PushProvider = {
  send: (payload: PushPayload) => Promise<void>;
};

let configuredProvider: PushProvider | null = null;
let warnedOnce = false;

export function setPushProvider(provider: PushProvider) {
  configuredProvider = provider;
}

export async function sendPush(payload: PushPayload): Promise<void> {
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
