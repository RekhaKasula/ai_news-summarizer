import axios from "axios";

const TOKEN_KEY = "ain_token"; // only the login token is kept in the browser; chats live in PostgreSQL

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, ""),
  timeout: 90000, // a news page may wait for several AI summaries
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url || "";
    const isAuthForm = url.startsWith("/auth/login") || url.startsWith("/auth/register");
    if (error.response?.status === 401 && !isAuthForm && tokenStore.get()) {
      tokenStore.clear();
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(error);
  }
);

/** Turn any axios/FastAPI error into a short message for the UI. */
export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (error?.code === "ECONNABORTED") return "The request took too long. Please try again.";
  if (error?.response) {
    const detail = error.response.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length) {
      const first = detail[0];
      const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : "";
      return field && field !== "body" ? `${field}: ${first.msg}` : first.msg;
    }
    return fallback;
  }
  if (error?.request) return "Cannot reach the server. Check your connection and that the backend is running.";
  return fallback;
}

export default api;
