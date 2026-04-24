import type { AuthPayload, RoleType, User } from "@saiyonix/types";
import {
  clearPushToken,
  clearSession,
  clearTokens,
  loadPushToken,
  loadSession,
  loadTokens,
  savePushToken,
  saveSession,
  saveTokens,
} from "./storage";
import { clearAuthTokens, setAuthTokens } from "@saiyonix/api";

export type AuthSnapshot = {
  user: User;
  role?: RoleType | null;
} | null;

type Listener = (auth: AuthSnapshot) => void;

let snapshot: AuthSnapshot = null;
const listeners = new Set<Listener>();
let pushToken: string | null = null;

function normalizeAuthSnapshot(next: AuthSnapshot): AuthSnapshot {
  if (!next) return null;
  const roleType = next.user?.role?.roleType ?? next.role ?? null;
  if (!roleType) return next;
  if (!next.user?.role) {
    return {
      ...next,
      user: {
        ...next.user,
        role: { id: next.user.roleId, roleType },
      },
    } as AuthSnapshot;
  }
  if (next.user.role.roleType !== roleType) {
    return {
      ...next,
      user: {
        ...next.user,
        role: { ...next.user.role, roleType },
      },
    } as AuthSnapshot;
  }
  return next;
}

export async function initAuthStore() {
  if (snapshot) return snapshot;
  const stored = await loadSession();
  if (stored) {
    snapshot = normalizeAuthSnapshot(stored as AuthSnapshot);
  }
  const storedPush = await loadPushToken();
  if (storedPush?.token) {
    pushToken = storedPush.token;
  }
  const tokens = await loadTokens();
  if (tokens) {
    setAuthTokens(tokens);
  }
  return snapshot;
}

export function getAuthSnapshot() {
  return snapshot;
}

export function subscribeAuth(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLastPushToken() {
  return pushToken;
}

export async function setLastPushToken(token: string | null) {
  pushToken = token;
  if (token) {
    await savePushToken({ token });
  } else {
    await clearPushToken();
  }
}

export async function setAuthSnapshot(
  next: AuthSnapshot | AuthPayload | ((prev: AuthSnapshot) => AuthSnapshot)
) {
  const resolved = typeof next === "function" ? next(snapshot) : next;
  const normalized =
    resolved && "user" in (resolved as any)
      ? { user: (resolved as AuthPayload).user, role: (resolved as AuthPayload).role }
      : (resolved as AuthSnapshot);

  snapshot = normalizeAuthSnapshot(normalized as AuthSnapshot);

  if (snapshot) {
    await saveSession(snapshot);
  } else {
    await clearSession();
  }
  listeners.forEach((listener) => listener(snapshot));
}

export async function setAuthTokensAndPersist(tokens: { accessToken?: string | null; refreshToken?: string | null }) {
  setAuthTokens(tokens);
  await saveTokens(tokens);
}

export async function clearAuthPersisted() {
  clearAuthTokens();
  await clearTokens();
  await clearSession();
  await clearPushToken();
  pushToken = null;
  snapshot = null;
  listeners.forEach((listener) => listener(snapshot));
}
