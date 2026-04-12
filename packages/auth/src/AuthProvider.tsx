import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthPayload, RoleType, User } from "@saiyonix/types";
import {
  getSession,
  loginWithPassword,
  logout as logoutRequest,
  refreshSession,
  resendOtp,
  sendOtp,
  verifyOtp,
  requestTeacherActivation,
  verifyTeacherActivation,
  completeTeacherActivation,
  requestTeacherForgotPassword,
  verifyTeacherForgotPassword,
  completeTeacherForgotPassword,
  sendPasswordResetOtp,
  verifyPasswordResetOtp as verifyPasswordResetOtpRequest,
  resetPassword as resetPasswordRequest,
} from "@saiyonix/api";
import { getAuthTokens, setUnauthorizedHandler } from "@saiyonix/api";
import {
  clearAuthPersisted,
  initAuthStore,
  setAuthSnapshot,
  setAuthTokensAndPersist,
  subscribeAuth,
  type AuthSnapshot,
} from "./authStore";

interface AuthContextValue {
  user: User | null;
  role: RoleType | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthPayload>;
  requestOtp: (mobile: string, studentNumber?: string) => Promise<void>;
  resendOtp: (mobile: string, studentNumber?: string) => Promise<void>;
  verifyOtp: (mobile: string, otp: string, studentNumber?: string) => Promise<AuthPayload>;
  requestPasswordResetOtp: (mobile: string) => Promise<void>;
  verifyPasswordResetOtp: (mobile: string, otp: string) => Promise<{ resetToken?: string } | void>;
  resetPassword: (resetToken: string, newPassword: string) => Promise<void>;
  requestTeacherActivation: (identifier: string) => Promise<void>;
  verifyTeacherActivation: (identifier: string, otp: string) => Promise<{ resetToken?: string } | void>;
  completeTeacherActivation: (resetToken: string, newPassword: string) => Promise<void>;
  requestTeacherForgotPassword: (identifier: string) => Promise<void>;
  verifyTeacherForgotPassword: (identifier: string, otp: string) => Promise<{ resetToken?: string } | void>;
  completeTeacherForgotPassword: (resetToken: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let sessionPromise: Promise<AuthSnapshot | null> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthSnapshot>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    setUnauthorizedHandler(async () => {
      await clearAuthPersisted();
    });

    const finishLoading = (payload: AuthSnapshot | null) => {
      if (!mounted) return;
      setAuth(payload);
      setIsLoading(false);
    };

    const unsubscribe = subscribeAuth((next) => {
      if (mounted) setAuth(next);
    });

    (async () => {
      const initialStore = await initAuthStore();
      if (initialStore) {
        finishLoading(initialStore);
        return;
      }

      const tokens = getAuthTokens();
      if (!tokens?.accessToken && tokens?.refreshToken) {
        try {
          const refreshed = await refreshSession(tokens.refreshToken);
          await setAuthTokensAndPersist({
            accessToken: refreshed.accessToken ?? null,
            refreshToken: refreshed.refreshToken ?? tokens.refreshToken ?? null,
          });
        } catch {
          await clearAuthPersisted();
          finishLoading(null);
          return;
        }
      } else if (!tokens?.accessToken) {
        finishLoading(null);
        return;
      }

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

      const session = await sessionPromise;
      finishLoading(session);
    })();

    return () => {
      mounted = false;
      unsubscribe();
      setUnauthorizedHandler(null);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: auth?.user ?? null,
      role:
        (auth?.user?.role?.roleType ??
          (auth as (AuthPayload & { role?: RoleType }) | null)?.role ??
          null),
      isLoading,
      login: async (email, password) => {
        const payload = await loginWithPassword(email, password);
        await setAuthTokensAndPersist({
          accessToken: payload.accessToken ?? null,
          refreshToken: payload.refreshToken ?? null,
        });
        await setAuthSnapshot(payload);
        return payload;
      },
      requestOtp: async (mobile, studentNumber) => {
        await sendOtp({ mobile, studentNumber });
      },
      resendOtp: async (mobile, studentNumber) => {
        await resendOtp({ mobile, studentNumber });
      },
      verifyOtp: async (mobile, otp, studentNumber) => {
        const payload = await verifyOtp({ mobile, otp, studentNumber });
        await setAuthTokensAndPersist({
          accessToken: payload.accessToken ?? null,
          refreshToken: payload.refreshToken ?? null,
        });
        await setAuthSnapshot(payload);
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
      requestTeacherActivation: async (identifier) => {
        await requestTeacherActivation(identifier);
      },
      verifyTeacherActivation: async (identifier, otp) => {
        return await verifyTeacherActivation(identifier, otp);
      },
      completeTeacherActivation: async (resetToken, newPassword) => {
        await completeTeacherActivation({
          resetToken,
          newPassword,
          confirmPassword: newPassword,
        });
      },
      requestTeacherForgotPassword: async (identifier) => {
        await requestTeacherForgotPassword(identifier);
      },
      verifyTeacherForgotPassword: async (identifier, otp) => {
        return await verifyTeacherForgotPassword(identifier, otp);
      },
      completeTeacherForgotPassword: async (resetToken, newPassword) => {
        await completeTeacherForgotPassword({
          resetToken,
          newPassword,
          confirmPassword: newPassword,
        });
      },
      logout: async () => {
        const tokens = getAuthTokens();
        try {
          await logoutRequest(tokens.refreshToken ?? undefined);
        } catch {
          // ignore
        }
        await clearAuthPersisted();
      },
    }),
    [auth, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
