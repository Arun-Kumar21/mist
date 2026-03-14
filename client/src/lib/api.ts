import axios from "axios";
import type { AuthResponse, Track, UserResponse } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window === "undefined") {
    return config;
  }

  const authStorage = localStorage.getItem("auth-storage");
  if (authStorage) {
    try {
      const { state } = JSON.parse(authStorage);
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
    } catch {
      // ignore malformed local storage
    }
  }
  return config;
});

export const authApi = {
  register: (username: string, password: string) =>
    api.post<AuthResponse>("/auth/register", { username, password }),

  login: (username: string, password: string) =>
    api.post<AuthResponse>("/auth/login", { username, password }),

  getMe: () => api.get<UserResponse>("/auth/me"),
};

export const tracksApi = {
  getTracks: (params?: { skip?: number; limit?: number; genre?: string }) =>
    api.get<{ success: boolean; count: number; tracks: Track[] }>("/tracks", { params }),

  searchTrack: (q: string) =>
    api.get<{ success: boolean; count: number; tracks: Track[] }>(`/tracks/search?q=${encodeURIComponent(q)}`),

  getTrack: (id: number) => api.get<{ success: boolean; track: Track }>(`/tracks/${id}`),

  getStreamInfo: (id: number) =>
    api.get<{
      success: boolean;
      trackId: number;
      streamUrl: string;
      keyEndpoint: string;
      duration: number;
      encrypted: boolean;
    }>(`/tracks/${id}/stream`),
};

export const uploadApi = {
  requestUpload: (data: { filename: string; filesize: number; contentType: string; metadata?: Record<string, string> }) =>
    api.post<{
      success: boolean;
      jobId: string;
      uploadUrl: string;
      fields: Record<string, string>;
      s3Key: string;
      expiresIn: number;
    }>("/upload/request", data),

  completeUpload: (data: { jobId: string; metadata?: Record<string, string> }) =>
    api.post<{ success: boolean; jobId: string; taskId: string; status: string }>("/upload/complete", data),

  getJobStatus: (jobId: string) =>
    api.get<{ jobId: string; status: string; track?: Track; error?: string }>(`/upload/job/${jobId}`),
};
