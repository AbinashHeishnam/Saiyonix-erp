interface ImportMetaEnv {
  readonly VITE_RAZORPAY_KEY_ID?: string;
  readonly VITE_OTP_DELIVERY_MODE?: "call" | "sms";
  readonly MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
