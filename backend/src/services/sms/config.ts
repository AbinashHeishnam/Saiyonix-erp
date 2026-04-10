import { ApiError } from "@/core/errors/apiError";
import { getSmsConfig } from "@/core/config/externalServices";
import type { OtpDeliveryMode } from "@/services/sms/types";

type SmsProvider = "twofactor" | "msg91";

type SmsOtpConfig = {
  enabled: boolean;
  provider?: SmsProvider;
};
type OtpDeliveryConfig = {
  enabled: boolean;
  mode: OtpDeliveryMode;
  provider?: SmsProvider;
};

function normalizeEnvFlag(value?: string) {
  if (value === undefined) return undefined;
  return value.toLowerCase();
}

function resolveOtpDeliveryMode(): OtpDeliveryMode {
  const raw = process.env.OTP_DELIVERY_MODE?.trim().toLowerCase();
  if (!raw) {
    return "call";
  }

  if (raw === "call" || raw === "sms") {
    return raw;
  }

  throw new ApiError(500, "OTP delivery mode is invalid");
}

function resolveProvider(input?: string): SmsProvider | undefined {
  if (!input) return undefined;
  const provider = input.toLowerCase();
  if (provider === "2factor" || provider === "twofactor") return "twofactor";
  if (provider === "msg91") return "msg91";
  return undefined;
}

function validateProviderCredentials(provider: SmsProvider) {
  if (provider === "twofactor") {
    if (
      !process.env.TWOFACTOR_API_KEY ||
      !process.env.TWOFACTOR_OTP_TEMPLATE_NAME
    ) {
      throw new ApiError(500, "OTP delivery is not configured");
    }
  }

  if (provider === "msg91") {
    if (!process.env.MSG91_AUTH_KEY) {
      throw new ApiError(500, "OTP delivery is not configured");
    }
  }
}

export async function resolveSmsOtpConfig(): Promise<SmsOtpConfig> {
  const envEnabled = normalizeEnvFlag(process.env.SMS_ENABLED);

  if (envEnabled === "true") {
    const provider = resolveProvider(process.env.SMS_PROVIDER);
    if (!provider) {
      throw new ApiError(500, "OTP delivery is not configured");
    }
    validateProviderCredentials(provider);
    return { enabled: true, provider };
  }

  if (envEnabled === "false") {
    return { enabled: false };
  }

  const smsConfig = await getSmsConfig("otp");
  if (!smsConfig.enabled) {
    return { enabled: false };
  }

  const provider = resolveProvider(smsConfig.provider);
  if (!provider) {
    throw new ApiError(500, "OTP delivery is not configured");
  }

  validateProviderCredentials(provider);
  return { enabled: true, provider };
}

export async function assertSmsOtpEnabled(): Promise<SmsOtpConfig> {
  const resolved = await resolveSmsOtpConfig();
  if (!resolved.enabled) {
    throw new ApiError(500, "SMS OTP delivery is not configured");
  }
  return resolved;
}

export async function resolveOtpDeliveryConfig(): Promise<OtpDeliveryConfig> {
  const mode = resolveOtpDeliveryMode();
  const smsConfig = await resolveSmsOtpConfig();
  if (!smsConfig.enabled) {
    return { enabled: false, mode };
  }

  return {
    enabled: true,
    mode,
    provider: smsConfig.provider,
  };
}

export async function assertOtpDeliveryConfigured(): Promise<Required<OtpDeliveryConfig>> {
  const resolved = await resolveOtpDeliveryConfig();
  if (!resolved.enabled || !resolved.provider) {
    throw new ApiError(500, "OTP delivery is not configured");
  }

  return {
    enabled: true,
    mode: resolved.mode,
    provider: resolved.provider,
  };
}

export { resolveOtpDeliveryMode };
