import axios, { AxiosError, AxiosInstance } from "axios";

import { getAuthSnapshot, getCsrfToken, setAuthSnapshot } from "./authStore";

export const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

axios.defaults.withCredentials = true;

export function resolvePublicUrl(fileUrl: string, token?: string) {
  if (!fileUrl) return "";

  const accessToken = token;

  if (/^https?:\/\//i.test(fileUrl)) {
    try {
      const url = new URL(fileUrl);
      if (url.origin === API_ORIGIN) {
        if (url.pathname.startsWith("/api/v1/files/secure")) {
          if (accessToken && !url.searchParams.has("token")) {
            url.searchParams.set("token", accessToken);
          }
          return url.toString();
        }
        if (url.pathname.startsWith("/storage") || url.pathname.startsWith("/uploads")) {
          const encoded = encodeURIComponent(url.pathname);
          return `${API_BASE_URL}/files/secure?fileUrl=${encoded}${accessToken ? `&token=${accessToken}` : ""}`;
        }
      }
    } catch {
      // fall through to return original URL
    }
    return fileUrl;
  }

  if (fileUrl.startsWith("/api/v1/files/secure")) {
    if (!accessToken) return `${API_ORIGIN}${fileUrl}`;
    return `${API_ORIGIN}${fileUrl}${fileUrl.includes("?") ? "&" : "?"}token=${accessToken}`;
  }

  const encoded = encodeURIComponent(fileUrl);
  return `${API_BASE_URL}/files/secure?fileUrl=${encoded}${accessToken ? `&token=${accessToken}` : ""}`;
}

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  withCredentials: true,
});

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use((config) => {
  const method = (config.method ?? "get").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken && config.headers) {
      config.headers["X-CSRF-Token"] = csrfToken;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }
    const requestUrl = originalRequest.url ?? "";
    const isAuthEndpoint = requestUrl.includes("/auth/");
    const isFileEndpoint = requestUrl.includes("/files/secure");

    if (error.response?.status === 403) {
      const snapshot = getAuthSnapshot();

      if (!snapshot || isAuthEndpoint || isFileEndpoint) {
        return Promise.reject(error);
      }

      if (snapshot.user?.mustChangePassword) {
        return Promise.reject(error);
      }

      if (snapshot.user?.restricted) {
        window.location.assign("/certificates");
      } else {
        window.location.assign("/unauthorized");
      }
      return Promise.reject(error);
    }

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    if (isAuthEndpoint || isFileEndpoint) {
      return Promise.reject(error);
    }

    if ((originalRequest as { _retry?: boolean })._retry) {
      return Promise.reject(error);
    }

    if (!refreshPromise) {
      refreshPromise = refreshClient
        .post("/auth/refresh", {})
        .then((res) => {
          const data = res.data?.data ?? res.data;
          if (!data?.csrfToken) return null;
          setAuthSnapshot((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              csrfToken: data.csrfToken,
            };
          });
          return data.csrfToken as string;
        })
        .catch(() => {
          setAuthSnapshot(null);
          return null;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    const nextCsrf = await refreshPromise;
    if (!nextCsrf) {
      const authRoutes = new Set([
        "/login",
        "/otp-login",
        "/email-otp-login",
        "/forgot-password",
        "/teacher-forgot-password",
        "/teacher-activate",
        "/admin-setup",
        "/setup-account",
      ]);
      if (!authRoutes.has(window.location.pathname)) {
        window.location.assign("/login");
      }
      return Promise.reject(error);
    }

    (originalRequest as { _retry?: boolean })._retry = true;
    if (originalRequest.headers && ["POST", "PUT", "PATCH", "DELETE"].includes((originalRequest.method ?? "get").toUpperCase())) {
      originalRequest.headers["X-CSRF-Token"] = nextCsrf;
    }

    return api(originalRequest);
  }
);

export default api;

/**
 * Global API Wrapper for mutations (POST, PATCH, DELETE)
 * Provides integrated toast feedback and error handling
 */
export async function safeApiCall<T>(
  apiFn: () => Promise<T>,
  options: {
    loading?: string;
    success?: string;
    showToast?: boolean;
  } = {}
): Promise<T> {
  const { loading = "Processing...", success = "Completed successfully", showToast = true } = options;
  const toastId = showToast ? toast.loading(loading) : undefined;

  try {
    const response: any = await apiFn();
    if (showToast) {
      // Use message from server if available, otherwise use default success message
      const message = response?.data?.message || response?.message || success;
      toast.success(message, { id: toastId });
    }
    return response;
  } catch (error: any) {
    if (showToast) {
      const errorMessage =
        error.response?.data?.message || error.message || "Something went wrong";
      toast.error(errorMessage, { id: toastId });
    }
    throw error;
  }
}

import toast from "react-hot-toast";
