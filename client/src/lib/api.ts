import axios from 'axios';
import type { AuthResponse, UserResponse, Track, ListeningQuota } from '../types';

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
        try {
            const { state } = JSON.parse(authStorage);
            if (state?.token) {
                config.headers.Authorization = `Bearer ${state.token}`;
            }
        } catch (e) {
            console.error('Failed to parse auth storage', e);
        }
    }
    return config;
});

export const authApi = {
    register: (username: string, email: string, password: string) =>
        api.post<AuthResponse>('/auth/register', { username, email, password }),

    login: (username: string, password: string) =>
        api.post<AuthResponse>('/auth/login', { username, password }),

    getMe: () => api.get<UserResponse>('/auth/me'),
};

export const tracksApi = {
    getTracks: (params?: { skip?: number; limit?: number; genre?: string }) =>
        api.get<Track[]>('/tracks', { params }),

    getPopular: () => api.get<Track[]>('/tracks/popular'),

    getTrack: (id: number) => api.get<Track>(`/tracks/${id}`),

    getStreamInfo: (id: number) => api.get<{
        success: boolean;
        trackId: number;
        streamUrl: string;
        keyEndpoint: string;
        duration: number;
        encrypted: boolean;
    }>(`/tracks/${id}/stream`),
};

export const listenApi = {
    getQuota: () => api.get<ListeningQuota>('/listen/quota'),

    startSession: (trackId: number) =>
        api.post<{ 
            success: boolean;
            trackId: number;
            streamUrl: string;
            keyEndpoint: string;
            duration: number;
            encrypted: boolean;
        }>('/listen/start', { track_id: trackId }),
};

export const uploadApi = {
    requestUpload: (data: {
        filename: string;
        filesize: number;
        contentType: string;
        metadata?: any;
    }) => api.post<{
        success: boolean;
        jobId: string;
        uploadUrl: string;
        fields: Record<string, string>;
        s3Key: string;
        expiresIn: number;
    }>('/upload/request', data),

    completeUpload: (data: { jobId: string; metadata: any }) =>
        api.post<{
            success: boolean;
            jobId: string;
            taskId: string;
            status: string;
        }>('/upload/complete', data),

    getJobStatus: (jobId: string) =>
        api.get<{
            jobId: string;
            status: string;
            createdAt: string;
            startedAt?: string;
            completedAt?: string;
            track?: Track;
            error?: string;
        }>(`/upload/job/${jobId}`),
};

export const adminApi = {
    updateTrack: (trackId: number, data: {
        title?: string;
        artist?: string;
        album?: string;
        genre?: string;
    }) => api.put<{ success: boolean; track: Track }>(`/tracks/${trackId}`, {
        title: data.title,
        artist_name: data.artist,
        album_title: data.album,
        genre_top: data.genre,
    }),

    deleteTrack: (trackId: number) =>
        api.delete<{ success: boolean; message: string }>(`/tracks/${trackId}`),
};
