import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { AuthPayload, RoleType, User } from "../types/auth";
import {
  loginWithPassword,
  logout,
  resendOtp,
  sendOtp,
  verifyOtp,
  sendPasswordResetOtp,
  verifyPasswordResetOtp as verifyPasswordResetOtpRequest,
  resetPassword as resetPasswordRequest,
  requestEmailOtp,
  resendEmailOtp,
  verifyEmailOtp,
  getSession,
} from "../services/api/auth";
import { initAuthStore, setAuthSnapshot, subscribeAuth, type AuthSnapshot } from "../services/api/authStore";
import { getLoginPathForRole } from "../utils/authRedirect";

interface AuthContextValue {
  user: User | null;
  role: RoleType | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthPayload>;
  requestOtp: (mobile: string) => Promise<void>;
  resendOtp: (mobile: string) => Promise<void>;
  verifyOtp: (mobile: string, otp: string) => Promise<AuthPayload>;
  requestEmailOtp: (email: string) => Promise<void>;
  resendEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, otp: string) => Promise<AuthPayload>;
  requestPasswordResetOtp: (mobile: string) => Promise<void>;
  verifyPasswordResetOtp: (mobile: string, otp: string) => Promise<{ resetToken?: string } | void>;
  resetPassword: (resetToken: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let sessionPromise: Promise<AuthSnapshot | null> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthSnapshot>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const initialStore = initAuthStore();

    const finishLoading = (payload: AuthSnapshot | null) => {
      if (!mounted) return;
      setAuth(payload);
      setIsLoading(false);
    };

    const unsubscribe = subscribeAuth((next) => {
      if (mounted) setAuth(next);
    });

    if (initialStore) {
      finishLoading(initialStore);
    } else {
      if (!sessionPromise) {
        sessionPromise = getSession()
          .then((session) => {
            if (session?.user) {
              setAuthSnapshot(session);
              return session;
            }
            return null;
          })
          .catch(() => null);
      }

      sessionPromise.then((session) => {
        finishLoading(session);
      });
    }

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: auth?.user ?? null,
      role: (auth?.user?.role?.roleType ??
        (auth as (AuthPayload & { role?: RoleType }) | null)?.role ??
        null),
      isLoading,
      login: async (email, password) => {
        const payload = await loginWithPassword(email, password);
        setAuthSnapshot(payload);
        return payload;
      },
      requestOtp: async (mobile) => {
        await sendOtp(mobile);
      },
      resendOtp: async (mobile) => {
        await resendOtp(mobile);
      },
      verifyOtp: async (mobile, otp) => {
        const payload = await verifyOtp(mobile, otp);
        setAuthSnapshot(payload);
        return payload;
      },
      requestEmailOtp: async (email) => {
        await requestEmailOtp(email);
      },
      resendEmailOtp: async (email) => {
        await resendEmailOtp(email);
      },
      verifyEmailOtp: async (email, otp) => {
        const payload = await verifyEmailOtp(email, otp);
        setAuthSnapshot(payload);
        return payload;
      },
      requestPasswordResetOtp: async (mobile) => {
        await sendPasswordResetOtp(mobile);
      },
      verifyPasswordResetOtp: async (mobile, otp) => {
        return await verifyPasswordResetOtpRequest(mobile, otp);
      },
      resetPassword: async (resetToken, newPassword) => {
        await resetPasswordRequest({
          resetToken,
          newPassword,
          confirmPassword: newPassword,
        });
      },
      logout: async () => {
        const roleType = auth?.user?.role?.roleType ?? auth?.role ?? null;
        const redirectTo = getLoginPathForRole(roleType);
        try {
          await logout();
        } catch {
          // ignore server errors
        }
        setAuthSnapshot(null);
        window.location.replace(redirectTo);
      },
    }),
    [auth, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
