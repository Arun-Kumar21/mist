import apiClient from "@/lib/api/client"

export type TrackSearchResult = {
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