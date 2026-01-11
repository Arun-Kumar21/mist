import axios from 'axios';
import type { AuthResponse, User, Track, ListeningQuota } from '../types';

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  register: (username: string, email: string, password: string) =>
    api.post<AuthResponse>('/auth/register', { username, email, password }),
  
  login: (username: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { username, password }),
  
  getMe: () => api.get<User>('/auth/me'),
};

export const tracksApi = {
  getTracks: (params?: { skip?: number; limit?: number; genre?: string }) =>
    api.get<Track[]>('/tracks', { params }),
  
  getPopular: () => api.get<Track[]>('/tracks/popular'),
  
  getTrack: (id: number) => api.get<Track>(`/tracks/${id}`),
};

export const listenApi = {
  getQuota: () => api.get<ListeningQuota>('/listen/quota'),
  
  startSession: (trackId: number) =>
    api.post<{ session_id: string }>('/listen/start', { track_id: trackId }),
};
