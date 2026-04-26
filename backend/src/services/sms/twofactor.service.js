import axios from "axios";
import { ApiError } from "@/core/errors/apiError";
import { logger } from "@/utils/logger";
const TWOFACTOR_ENDPOINT = "https://2factor.in/API/V1";
const DEFAULT_COUNTRY_CODE = "91";
function normalizePhone(input) {
    const digits = input.replace(/\D/g, "");
    if (digits.length === 10) {
        return `${DEFAULT_COUNTRY_CODE}${digits}`;
    }
    if (digits.length === 12 && digits.startsWith(DEFAULT_COUNTRY_CODE)) {
        return digits;
    }
    throw new ApiError(400, "Invalid phone number");
}
function getApiKey() {
    const smsKey = process.env.TWOFACTOR_API_KEY;
    if (!smsKey) {
        throw new ApiError(500, "OTP delivery is not configured");
    }
    return smsKey;
}
function getTemplateName() {
    const templateName = process.env.TWOFACTOR_OTP_TEMPLATE_NAME?.trim();
    if (!templateName) {
        throw new ApiError(500, "OTP delivery is not configured");
    }
    return templateName;
}
export async function sendPhoneOtp(phone, otp, mode) {
    const apiKey = getApiKey();
    const mobile = normalizePhone(phone);
    const templateName = getTemplateName();
    try {
        // NOTE: Call mode currently uses the SMS endpoint while DLT registration is pending.
        const url = `${TWOFACTOR_ENDPOINT}/${apiKey}/SMS/${mobile}/${otp}/${templateName}`;
        const response = await axios.get(url, {
            timeout: 10_000,
            validateStatus: (status) => status >= 200 && status < 300,
        });
        const data = response.data;
        const status = data?.Status ?? "Unknown";
        const details = data?.Details ?? "No details";
        logger.info(`[OTP][2FACTOR] mode=${mode} status=${status} details=${details} template=${templateName} mobile=${mobile}`);
        if (status !== "Success") {
            throw new ApiError(502, "OTP delivery failed");
        }
        return { success: true };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error(`[OTP][2FACTOR] mode=${mode} send error: ${message}`);
        throw new ApiError(502, "OTP delivery failed");
    }
}
export async function sendSMSOtp(phone, otp) {
    return sendPhoneOtp(phone, otp, "sms");
}
// TSMS endpoint is intentionally not used for OTP template delivery.
