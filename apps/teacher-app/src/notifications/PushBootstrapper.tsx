import React, { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useAuth } from "@saiyonix/auth";
import { useQueryClient } from "@tanstack/react-query";

import { navigationRef } from "../navigation/navigationRef";
import { setNotificationResponseHandler, syncLastPushTokenToBackend } from "../services/pushNotifications";

function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function routeFromPayload(data: Record<string, unknown>) {
  const type = safeString(data.type).toLowerCase();
  const linkUrl = safeString(data.linkUrl);

  if (type === "attendance" || linkUrl.startsWith("/attendance")) {
    return { screen: "Tabs" as const, params: { screen: "Attendance" as const } };
  }

  if (type === "notice" || linkUrl.startsWith("/notices")) {
    return { screen: "TeacherNotices" as const };
  }

  return { screen: "Tabs" as const, params: { screen: "Alerts" as const } };
}

export default function PushBootstrapper() {
  const { user } = useAuth();
  const lastRegisteredUserId = useRef<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    if (lastRegisteredUserId.current === user.id) return;
    lastRegisteredUserId.current = user.id;

    void syncLastPushTokenToBackend()
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      })
      .catch((err) => {
        console.error("[PUSH] Backend token sync failed (post-auth):", err);
      });
  }, [user?.id]);

  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      const target = routeFromPayload(data);
      if (!navigationRef.isReady()) return;
      navigationRef.navigate("App" as never, target as never);
    };

    setNotificationResponseHandler(handleResponse);

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleResponse(response);
      })
      .catch(() => {});

    return () => {
      setNotificationResponseHandler(null);
    };
  }, []);

  return null;
}
