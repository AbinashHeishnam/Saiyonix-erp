import React, { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useAuth } from "@saiyonix/auth";
import { useQueryClient } from "@tanstack/react-query";

import { navigationRef } from "../navigation/navigationRef";
import {
  setNotificationResponseHandler,
  syncLastPushTokenToBackend,
} from "../services/pushNotifications";

function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function routeFromPayload(data: Record<string, unknown>) {
  const type = safeString(data.type).toLowerCase();
  const linkUrl = safeString(data.linkUrl);

  if (type === "attendance" || linkUrl.startsWith("/attendance")) {
    return { name: "Attendance", params: {} };
  }

  if (type === "notice" || linkUrl.startsWith("/notices")) {
    return { name: "TeacherNotices", params: {} };
  }

  return { name: "Alerts", params: {} };
}

export default function PushBootstrapper() {
  const { user } = useAuth();
  const lastSyncedUserId = useRef<string | null>(null);
  const queryClient = useQueryClient();

  // 🔥 TOKEN SYNC AFTER LOGIN
  useEffect(() => {
    if (!user?.id) {
      console.log("[PUSH] No user yet");
      return;
    }

    if (lastSyncedUserId.current === user.id) {
      console.log("[PUSH] Already synced");
      return;
    }

    lastSyncedUserId.current = user.id;

    console.log("[PUSH] Syncing token for:", user.id);

    syncLastPushTokenToBackend()
      .then(() => {
        console.log("[PUSH] Sync OK");

        queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      })
      .catch((err) => {
        console.error("[PUSH] Sync FAILED:", err);
      });
  }, [user?.id, queryClient]);

  // 🔥 HANDLE CLICK
  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse) => {
      console.log("[PUSH] Click received");

      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      const target = routeFromPayload(data);

      if (!navigationRef.isReady()) {
        console.warn("[PUSH] Navigation not ready");
        return;
      }

      // ✅ FIXED NAVIGATION (NO NEVER ERROR)
      navigationRef.navigate(target.name as any, target.params as any);
    };

    setNotificationResponseHandler(handleResponse);

    // cold start
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          console.log("[PUSH] Opened from killed state");
          handleResponse(response);
        }
      })
      .catch((err) => {
        console.error("[PUSH] Cold start error:", err);
      });

    return () => {
      setNotificationResponseHandler(null);
    };
  }, []);

  return null;
}