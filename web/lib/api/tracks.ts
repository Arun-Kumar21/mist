import apiClient from "@/lib/api/client"

export type TrackListItem = {
  track_id: number
  title: string | null
  artist_name: string | null
  album_title: string | null
  genre_top: string | null
  cover_image_url: string | null
  cdn_url: string | null
  duration_sec: number | null
  listens: number | null
  interest: number | null
  processing_status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type TrackSearchResult = TrackListItem

export async function getTracks(limit = 20, skip = 0, genre?: string | null) {
  const { data } = await apiClient.get<{
    success: boolean
    count: number
    tracks: TrackListItem[]
  }>("/tracks", {
    params: {
      limit,
      skip,
      ...(genre ? { genre } : {}),
    },
  })

  return data
}

export async function searchTracks(search: string) {
  const { data } = await apiClient.get<{
    success: boolean
    query: string
    count: number
    tracks: TrackSearchResult[]
  }>("/tracks/search", {
    params: {
      q: search,
    },
  })

  return data
}