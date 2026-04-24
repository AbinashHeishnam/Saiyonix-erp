import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { initFcmPush } from "../services/fcmNotifications";

export default function FcmBootstrapper() {
  const { user } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    if (started.current) return;

    const start = async () => {
      const result = await initFcmPush();
      if (!result.enabled && result.reason === "RELOAD_REQUIRED") {
        // initFcmPush() already triggers the one-time reload.
        return;
      }
    };

    started.current = true;
    void start().catch(() => {});
  }, [user?.id]);

  return null;
}
