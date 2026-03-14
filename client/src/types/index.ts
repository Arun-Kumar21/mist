export interface User {
  id: string;
  username: string;
  role: "user" | "admin";
}

export interface UserResponse {
  user_id: string;
  username: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  type: string;
  user_id?: string;
  username?: string;
  role?: string;
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
}
