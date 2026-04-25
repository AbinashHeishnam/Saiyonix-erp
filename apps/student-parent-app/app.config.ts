import type { ExpoConfig, ConfigContext } from "@expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,

  name: "SaiyoniX",
  slug: "saiyonix-student-parent",
  scheme: "saiyonix",

  version: "0.1.0",
  orientation: "portrait",

  icon: "./assets/icon.png",

  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#1e223c",
  },

  android: {
    package: "com.saiyonix.studentparent",
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
  },

  plugins: ["expo-notifications", "expo-secure-store"],

  extra: {
    apiBaseUrl:
      process.env.EXPO_PUBLIC_API_BASE_URL ??
      "https://api.kangleicareersolution.co.in/api/v1",

    eas: {
      projectId: "617d2f5b-6587-4917-8dc7-d305b77ef56c",
    },
  },
});
