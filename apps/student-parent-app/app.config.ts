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
    useNextNotificationsApi: true,
  },

  plugins: ["expo-notifications", "expo-secure-store"],

  extra: {
    apiBaseUrl:
      process.env.EXPO_PUBLIC_API_BASE_URL ??
      "https://api.kangleicareersolution.co.in/api/v1",

    eas: {
      projectId:
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "2fb69882-9f6c-447b-a144-cc95cdb8e7c6",
    },
  },
});
