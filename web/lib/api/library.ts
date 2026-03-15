import apiClient from "@/lib/api/client"
import { useAuthStore } from "@/lib/stores/auth-store"
import type { TrackListItem } from "@/lib/api/tracks"

function authHeaders() {
  const token = useAuthStore.getState().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type RawLikedTrackRow = {
  liked_at: string | null
  track: TrackListItem
}

export type LikedTrack = TrackListItem & {
  liked_at: string | null
}

export async function getLikedTracks(limit = 50, offset = 0): Promise<LikedTrack[]> {
  const { data } = await apiClient.get<{
    success: boolean
    count: number
    tracks: RawLikedTrackRow[]
  }>("/library/likes", {
    params: { limit, offset },
    headers: authHeaders(),
  })

  return data.tracks.map((row) => ({
    ...row.track,
    liked_at: row.liked_at,
  }))
}

export type FeedSeedTrack = TrackListItem & {
  play_count?: number
  total_duration?: number
}

export type FeedRecommendation = TrackListItem & {
  recommendation_score: number
  based_on_track_ids: number[]
  reasons: string[]
}

export type PersonalizedFeed = {
  liked_seed_tracks: FeedSeedTrack[]
  listened_seed_tracks: FeedSeedTrack[]
  recommendations: FeedRecommendation[]
  count: number
}

export async function getPersonalizedFeed(limit = 24): Promise<PersonalizedFeed> {
  const { data } = await apiClient.get<{
    success: boolean
    liked_seed_tracks: FeedSeedTrack[]
    listened_seed_tracks: FeedSeedTrack[]
    recommendations: FeedRecommendation[]
    count: number
  }>("/library/feed", {
    params: { limit },
    headers: authHeaders(),
  })

  return {
    liked_seed_tracks: data.liked_seed_tracks,
    listened_seed_tracks: data.listened_seed_tracks,
    recommendations: data.recommendations,
    count: data.count,
  }
}

export type Playlist = {
  playlist_id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  created_at: string | null
  updated_at: string | null
}

export type PlaylistTrackRow = {
  position: number
  added_at: string | null
  track: TrackListItem
}

export async function createPlaylist(payload: {
  name: string
  description?: string
  is_public?: boolean
}): Promise<Playlist> {
  const { data } = await apiClient.post<{ success: boolean; playlist: Playlist }>(
    "/library/playlists",
    {
      name: payload.name,
      description: payload.description ?? null,
      is_public: payload.is_public ?? false,
    },
    { headers: authHeaders() }
  )

  return data.playlist
}

export async function addTrackToPlaylist(playlistId: string, trackId: number): Promise<void> {
  await apiClient.post(
    `/library/playlists/${playlistId}/tracks/${trackId}`,
    null,
    { headers: authHeaders() }
  )
}

export async function getPlaylistById(playlistId: string): Promise<{ playlist: Playlist; tracks: PlaylistTrackRow[] }> {
  const { data } = await apiClient.get<{ success: boolean; playlist: Playlist; tracks: PlaylistTrackRow[] }>(
    `/library/playlists/${playlistId}`,
    { headers: authHeaders() }
  )

  return {
    playlist: data.playlist,
    tracks: data.tracks,
  }
}
