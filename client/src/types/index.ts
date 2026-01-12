export interface User {
    id: number;
    username: string;
    role: 'user' | 'admin';
}

export interface UserResponse {
    user_id: string;
    username: string;
    role: string;
}

export interface AuthResponse {
    token: string;
    type: string;
}

export interface Track {
    track_id: number;
    title: string;
    artist_name: string;
    album_title?: string;
    genre_top?: string;
    duration_sec: number;
    listens: number;
    cdn_url?: string;
    processing_status: string;
    created_at: string;
    updated_at?: string;
    date_created?: string;
    file_size_mb?: number;
    interest: number;
}

export interface ListeningQuota {
    total_quota: number;
    used_quota: number;
    remaining_quota: number;
    is_authenticated: boolean;
}
