import api from "./client";
import type { AuthPayload } from "../../types/auth";

export async function loginWithPassword(email: string, password: string) {
  const res = await api.post("/auth/login", { email, password });
  return (res.data?.data ?? res.data) as AuthPayload;
}

export async function getSession() {
  const res = await api.get("/auth/me");
  return res.data?.data ?? res.data;
}

export async function sendOtp(mobile: string) {
  const res = await api.post("/auth/otp/send", { mobile });
  return res.data?.data ?? res.data;
}

export async function resendOtp(mobile: string) {
  const res = await api.post("/auth/otp/resend", { mobile });
  return res.data?.data ?? res.data;
}

export async function verifyOtp(mobile: string, otp: string) {
  const res = await api.post("/auth/otp/verify", { mobile, otp });
  return (res.data?.data ?? res.data) as AuthPayload;
}

export async function requestEmailOtp(email: string) {
  const res = await api.post("/auth/email-otp/request", { email });
  return res.data?.data ?? res.data;
}

export async function resendEmailOtp(email: string) {
  const res = await api.post("/auth/email-otp/resend", { email });
  return res.data?.data ?? res.data;
}

export async function verifyEmailOtp(email: string, otp: string) {
  const res = await api.post("/auth/email-otp/verify", { email, otp });
  return (res.data?.data ?? res.data) as AuthPayload;
}

export async function logout() {
  const res = await api.post("/auth/logout", {});
  return res.data?.data ?? res.data;
}

export async function sendSetupOtp(mobile: string) {
  const res = await api.post("/auth/setup/otp/send", { mobile });
  return res.data?.data ?? res.data;
}

export async function verifySetupOtp(mobile: string, otp: string) {
  const res = await api.post("/auth/setup/otp/verify", { mobile, otp });
  return res.data?.data ?? res.data;
}

export async function completeSetup(params: {
  mobile: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const res = await api.post("/auth/setup/complete", params);
  return res.data?.data ?? res.data;
}

export async function completeAdminSetup(params: {
  email: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const res = await api.post("/auth/admin-setup/complete", params);
  return (res.data?.data ?? res.data) as AuthPayload;
}

export async function verifyAdminSetupOtp(params: { email: string; otp: string }) {
  const res = await api.post("/auth/admin-setup/verify-otp", params);
  return res.data?.data ?? res.data;
}

export async function sendAdminSetupOtp() {
  const res = await api.post("/auth/admin-setup/otp/send");
  return res.data?.data ?? res.data;
}

export async function sendPasswordResetOtp(mobile: string) {
  const res = await api.post("/auth/password/otp/send", { mobile });
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
