export type OtpDeliveryMode = "call" | "sms";

const rawMode = (import.meta as any).env.VITE_OTP_DELIVERY_MODE as
  | OtpDeliveryMode
  | undefined;

export const OTP_DELIVERY_MODE: OtpDeliveryMode = rawMode === "sms" ? "sms" : "call";
