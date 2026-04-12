export type PushRegistration = {
  token: string;
  platform: "ios" | "android" | "web";
};

export async function registerForPushNotifications(): Promise<PushRegistration | null> {
  // Scaffold for future Firebase/Expo push integration.
  return null;
}

export function handlePushNotification(data: Record<string, unknown>) {
  // Placeholder for routing based on notification payload.
  return data;
}
