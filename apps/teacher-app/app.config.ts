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
  },
  plugins: ["expo-notifications", "expo-secure-store"],
  extra: {
    apiBaseUrl:
      process.env.EXPO_PUBLIC_API_BASE_URL ??
      "https://api.kangleicareersolution.co.in/api/v1",
    eas: {
      projectId: "84df03a9-3d48-47e7-a434-b416a7563cd1",
    },
  },
});