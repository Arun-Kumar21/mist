export interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  daily_listen_quota: number;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Track {
  id: number;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  duration_seconds: number;
  play_count: number;
  hls_url?: string;
  created_at: string;
}

export interface ListeningQuota {
  total_quota: number;
  used_quota: number;
  remaining_quota: number;
  is_authenticated: boolean;
}
