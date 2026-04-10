declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: "development" | "production" | "test";
    PORT?: string;
    DATABASE_URL: string;
    JWT_SECRET: string;
    ALLOW_PUBLIC_REGISTRATION?: string;
    DEBUG_ROUTES_ENABLED?: string;
    SMS_OTP_LOG?: string;
    OTP_DELIVERY_MODE?: "call" | "sms";
    SMS_ENABLED?: string;
    SMS_PROVIDER?: string;
    TWOFACTOR_API_KEY?: string;
    TWOFACTOR_SENDER_ID?: string;
    TWOFACTOR_OTP_TEMPLATE_NAME?: string;
    TWOFACTOR_OTP_TEMPLATE_BODY?: string;
    R2_ACCOUNT_ID?: string;
    R2_ACCESS_KEY_ID?: string;
    R2_SECRET_ACCESS_KEY?: string;
    R2_BUCKET_NAME?: string;
    R2_ENDPOINT?: string;
    MSG91_AUTH_KEY?: string;
    MSG91_TEMPLATE_ID?: string;
    REDIS_ENABLED?: string;
    REDIS_URL?: string;
    EMAIL_PROVIDER?: "resend";
    EMAIL_ENABLED?: string;
    EMAIL_LOG_IN_DEV?: string;
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    EMAIL_OTP_MODE?: "log" | "email" | "both";
    EMAIL_OTP_EXPIRY_MINUTES?: string;
    EMAIL_OTP_RESEND_COOLDOWN_SECONDS?: string;
    EMAIL_OTP_MAX_ATTEMPTS?: string;
  }
}
