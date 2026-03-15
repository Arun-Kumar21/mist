import apiClient from "@/lib/api/client"

export type HomePopularPlaylist = {
  playlist: {
    playlist_id: string
    user_id: string
    name: string
    description: string | null
    is_public: boolean
    created_at: string | null
    updated_at: string | null
  }
  total_listens: number
  track_count: number
  cover_image_url: string | null
}

export type HomeTrack = {
  track_id: number
  title: string | null
  artist_name: string | null
  cover_image_url: string | null
  cdn_url: string | null
}

export type HomeTopPick = {
  curation: {
    id: number
    track_id: number
    display_order: number
    is_active: boolean
  }
  track: HomeTrack
}

export type HomeSectionsResponse = {
  success: boolean
  sections: {
    popular_songs: HomeTrack[]
    most_listened: HomeTrack[]
    top_pick: HomeTopPick[]
    popular_playlists: HomePopularPlaylist[]
  }
}

export async function getHomeSections(limit = 8) {
  const { data } = await apiClient.get<HomeSectionsResponse>("/home/sections", {
    params: { limit },
  })

  return {
    popularSongs: data.sections.popular_songs,
    mostListened: data.sections.most_listened,
    topPick: data.sections.top_pick.map((row) => row.track),
    popularPlaylists: data.sections.popular_playlists ?? [],
  }
}
