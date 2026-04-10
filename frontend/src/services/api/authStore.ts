import type { AuthPayload, RoleType, User } from "../../types/auth";
import { clearSession, loadSession, saveSession } from "../storage";

export type AuthSnapshot = {
  user: User;
  csrfToken?: string | null;
  role?: RoleType | null;
} | null;

type Listener = (auth: AuthSnapshot) => void;

let snapshot: AuthSnapshot = null;
const listeners = new Set<Listener>();

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
    };
  }
  if (next.user.role.roleType !== roleType) {
    return {
      ...next,
      user: {
        ...next.user,
        role: { ...next.user.role, roleType },
      },
    };
  }
  return next;
}

export function initAuthStore() {
  if (snapshot) return snapshot;
  const stored = loadSession();
  if (stored) {
    snapshot = normalizeAuthSnapshot(stored as AuthSnapshot);
  }
  return snapshot;
}

export function getAuthSnapshot() {
  return snapshot;
}

export function subscribeAuth(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setAuthSnapshot(
  next: AuthSnapshot | AuthPayload | ((prev: AuthSnapshot) => AuthSnapshot)
) {
  const resolved = typeof next === "function" ? next(snapshot) : next;
  const normalized =
    resolved && "user" in (resolved as any)
      ? { user: (resolved as AuthPayload).user, csrfToken: (resolved as AuthPayload).csrfToken }
      : (resolved as AuthSnapshot);
  snapshot = normalizeAuthSnapshot(normalized as AuthSnapshot);
  if (snapshot) {
    saveSession(snapshot);
  } else {
    clearSession();
  }
  listeners.forEach((listener) => listener(snapshot));
}

export function getCsrfToken() {
  return snapshot?.csrfToken ?? null;
}
