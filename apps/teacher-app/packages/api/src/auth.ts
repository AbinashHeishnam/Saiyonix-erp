import api from "./client";
import type { AuthPayload } from "@saiyonix/types";

export async function loginWithPassword(email: string, password: string) {
  const res = await api.post("/auth/login", { email, password });
  return (res.data?.data ?? res.data) as AuthPayload;
}

export async function getSession() {
  const res = await api.get("/auth/me");
  return res.data?.data ?? res.data;
}

export async function sendOtp(payload: { mobile: string; studentNumber?: string; channel?: "sms" | "call" }) {
  const res = await api.post("/auth/otp/send", payload);
  return res.data?.data ?? res.data;
}

export async function resendOtp(payload: { mobile: string; studentNumber?: string; channel?: "sms" | "call" }) {
  const res = await api.post("/auth/otp/resend", payload);
  return res.data?.data ?? res.data;
}

export async function verifyOtp(payload: { mobile: string; otp: string; studentNumber?: string }) {
  const res = await api.post("/auth/otp/verify", payload);
  return (res.data?.data ?? res.data) as AuthPayload;
}

export async function logout(refreshToken?: string | null) {
  const res = await api.post("/auth/logout", refreshToken ? { refreshToken } : {});
  return res.data?.data ?? res.data;
}

export async function refreshSession(refreshToken: string) {
  const res = await api.post("/auth/refresh", { refreshToken });
  return res.data?.data ?? res.data;
}

export async function sendPasswordResetOtp(mobile: string, channel?: "sms" | "call") {
  const res = await api.post("/auth/password/otp/send", { mobile, ...(channel ? { channel } : {}) });
  return res.data?.data ?? res.data;
}

export async function verifyPasswordResetOtp(mobile: string, otp: string) {
  const res = await api.post("/auth/password/otp/verify", { mobile, otp });
  return res.data?.data ?? res.data;
}

export async function resetPassword(payload: {
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const res = await api.post("/auth/password/reset", payload);
  return res.data?.data ?? res.data;
}

export async function requestTeacherActivation(identifier: string) {
  const res = await api.post("/auth/teacher-activate/request", { identifier });
  return res.data?.data ?? res.data;
}

export async function verifyTeacherActivation(identifier: string, otp: string) {
  const res = await api.post("/auth/teacher-activate/verify", { identifier, otp });
  return res.data?.data ?? res.data;
}

export async function completeTeacherActivation(payload: {
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const res = await api.post("/auth/teacher-activate/complete", payload);
  return res.data?.data ?? res.data;
}

export async function requestTeacherForgotPassword(identifier: string) {
  const res = await api.post("/auth/teacher-forgot-password/request", { identifier });
  return res.data?.data ?? res.data;
}

export async function verifyTeacherForgotPassword(identifier: string, otp: string) {
  const res = await api.post("/auth/teacher-forgot-password/verify", { identifier, otp });
  return res.data?.data ?? res.data;
}

export async function completeTeacherForgotPassword(payload: {
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const res = await api.post("/auth/teacher-forgot-password/complete", payload);
  return res.data?.data ?? res.data;
}
