import axios, { AxiosError, AxiosInstance } from "axios";
import "react-native-url-polyfill/auto";
import Constants from "expo-constants";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

type ExpoExtra = {
  apiBaseUrl?: string;
};

function getExpoApiBaseUrl() {
  const extra =
    (Constants.expoConfig?.extra as ExpoExtra | undefined) ??
    ((Constants as any).manifest2?.extra as ExpoExtra | undefined) ??
    ((Constants as any).manifest?.extra as ExpoExtra | undefined);

  return extra?.apiBaseUrl;
}

export function setAuthTokens(next: { accessToken?: string | null; refreshToken?: string | null }) {
  if (typeof next.accessToken !== "undefined") accessToken = next.accessToken;
  if (typeof next.refreshToken !== "undefined") refreshToken = next.refreshToken;
}

export function clearAuthTokens() {
  accessToken = null;
  refreshToken = null;
}

export function getAuthTokens() {
  return { accessToken, refreshToken };
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ??
  getExpoApiBaseUrl() ??
  "https://api.kangleicareersolution.co.in/api/v1"; // 🔥 NO localhost anymore

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

export function resolvePublicUrl(fileUrl: string, token?: string | null) {
  if (!fileUrl) return "";
  const access = token ?? accessToken;

  if (/^https?:\/\//i.test(fileUrl)) {
    try {
      const url = new URL(fileUrl);
      if (url.origin === API_ORIGIN) {
        if (url.pathname.startsWith("/api/v1/files/secure")) {
          if (access && !url.searchParams.has("token")) {
            url.searchParams.set("token", access);
          }
          return url.toString();
        }
        if (url.pathname.startsWith("/storage") || url.pathname.startsWith("/uploads")) {
          const encoded = encodeURIComponent(url.pathname);
          return `${API_BASE_URL}/files/secure?fileUrl=${encoded}${access ? `&token=${access}` : ""}`;
        }
      }
    } catch {
      return fileUrl;
    }
    return fileUrl;
  }

  if (fileUrl.startsWith("/api/v1/files/secure")) {
    if (!access) return `${API_ORIGIN}${fileUrl}`;
    return `${API_ORIGIN}${fileUrl}${fileUrl.includes("?") ? "&" : "?"}token=${access}`;
  }

  const encoded = encodeURIComponent(fileUrl);
  return `${API_BASE_URL}/files/secure?fileUrl=${encoded}${access ? `&token=${access}` : ""}`;
}

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

const refreshClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use((config) => {
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    const requestUrl = originalRequest.url ?? "";
    const isAuthEndpoint = requestUrl.includes("/auth/");

    if (error.response?.status !== 401 || isAuthEndpoint) {
      return Promise.reject(error);
    }

    if ((originalRequest as { _retry?: boolean })._retry) {
      return Promise.reject(error);
    }

    if (!refreshToken) {
      unauthorizedHandler?.();
      return Promise.reject(error);
    }

    if (!refreshPromise) {
      refreshPromise = refreshClient
        .post("/auth/refresh", { refreshToken })
        .then((res) => {
          const data = res.data?.data ?? res.data;
          if (!data?.accessToken) return null;
          setAuthTokens({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken ?? refreshToken,
          });
          return data.accessToken as string;
        })
        .catch(() => {
          clearAuthTokens();
          unauthorizedHandler?.();
          return null;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    const nextToken = await refreshPromise;
    if (!nextToken) {
      return Promise.reject(error);
    }

    (originalRequest as { _retry?: boolean })._retry = true;
    if (originalRequest.headers) {
      originalRequest.headers.Authorization = `Bearer ${nextToken}`;
    }
    return api(originalRequest);
  }
);

export default api;
