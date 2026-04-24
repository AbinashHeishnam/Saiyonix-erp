export type PushRegistration = {
  token: string;
  platform: "ios" | "android" | "web";
};

export async function registerForPushNotifications(): Promise<PushRegistration | null> {
  // Expo push (mobile) registration.
  // Web push is handled in the web app via Service Worker.
  const Notifications = await import("expo-notifications");
  const Device = await import("expo-device");
  const Constants = (await import("expo-constants")).default;
  const { Platform } = await import("react-native");

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  if (!Device.isDevice) {
    return null;
  }

  const permissions = await Notifications.getPermissionsAsync();
  let status = permissions.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0ea5e9",
    });
  }

  const extra = (Constants.expoConfig?.extra as any) ?? {};
  const projectId =
    extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId ??
    undefined;

  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );

  return {
    token: token.data,
    platform: Platform.OS as "ios" | "android",
  };
}

export function handlePushNotification(data: Record<string, unknown>) {
  // Placeholder for routing based on notification payload.
  return data;
}
