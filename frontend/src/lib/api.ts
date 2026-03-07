const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!rawApiBaseUrl) {
  throw new Error("Missing VITE_API_BASE_URL in frontend env");
}

export const API_BASE_URL = rawApiBaseUrl.replace(/\/$/, "");
