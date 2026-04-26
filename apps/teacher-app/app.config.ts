import type { ExpoConfig, ConfigContext } from "@expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "SaiyoniX Teacher",
  slug: "saiyonix-teacher",
  scheme: "saiyonix-teacher",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#1e223c",
  },
  android: {
    package: "com.saiyonix.teacher",
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",  // ✅ IMPORTANT
  },
  plugins: ["expo-notifications", "expo-secure-store"],
  extra: {
    apiBaseUrl:
      process.env.EXPO_PUBLIC_API_BASE_URL ??
      "https://api.kangleicareersolution.co.in/api/v1",
    eas: {
      projectId: "e686774f-8c13-4acb-be97-d4d3a813c43e",
    },
  },
});