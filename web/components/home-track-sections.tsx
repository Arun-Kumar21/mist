"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getHomeSections, type HomeTrack } from "@/lib/api/home"
import { TrackCard } from "@/components/track-card"
import { usePlayerStore } from "@/lib/stores/player-store"
import { useAuthStore } from "@/lib/stores/auth-store"
import { getTrackLikeStatus, likeTrack, unlikeTrack } from "@/lib/api/player"
import { useTrackLikesStore } from "@/lib/stores/track-likes-store"
import { Music2 } from "lucide-react"

type HomeSectionsState = {
  popularSongs: HomeTrack[]
  mostListened: HomeTrack[]
  topPick: HomeTrack[]
  popularPlaylists: Array<{
    playlist: {
      playlist_id: string
      name: string
      description: string | null
      is_public: boolean
    }
    total_listens: number
    track_count: number
    cover_image_url: string | null
  }>
}

const initialState: HomeSectionsState = {
  popularSongs: [],
  mostListened: [],
  topPick: [],
  popularPlaylists: [],
}

function PlaylistRow({
  playlists,
}: {
  playlists: HomeSectionsState["popularPlaylists"]
}) {
  if (!playlists.length) return null

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Popular Playlists</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {playlists.map((entry) => (
          <Link
            key={entry.playlist.playlist_id}
            href={`/playlists/${entry.playlist.playlist_id}`}
            className="group rounded-xl border border-border/70 bg-card/70 p-3 transition-colors hover:bg-card"
          >
            <div className="relative mb-3 aspect-16/10 overflow-hidden rounded-lg bg-muted">
              {entry.cover_image_url ? (
                <img
                  src={entry.cover_image_url}
                  alt={entry.playlist.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Music2 className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <p className="truncate text-sm font-medium text-foreground">{entry.playlist.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {entry.track_count} songs • {entry.total_listens.toLocaleString()} listens
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function TrackRow({ title, tracks }: { title: string; tracks: HomeTrack[] }) {
  const setQueueAndPlay = usePlayerStore((s) => s.setQueueAndPlay)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const likedMap = useTrackLikesStore((s) => s.likes)
  const setManyLikeStatuses = useTrackLikesStore((s) => s.setManyLikeStatuses)
  const setLikeStatus = useTrackLikesStore((s) => s.setLikeStatus)
  const clearLikes = useTrackLikesStore((s) => s.clearLikes)

  useEffect(() => {
    let cancelled = false

    if (!isAuthenticated) {
      clearLikes()
      return
    }

    const loadLikes = async () => {
      const results = await Promise.all(
        tracks.map(async (track) => {
          try {
            const response = await getTrackLikeStatus(track.track_id)
            return [track.track_id, response.liked] as const
          } catch {
            return [track.track_id, false] as const
          }
        })
      )

      if (cancelled) return

      setManyLikeStatuses(results.map((entry) => [entry[0], entry[1]]))
    }

    loadLikes()

    return () => {
      cancelled = true
    }
  }, [tracks, isAuthenticated, clearLikes, setManyLikeStatuses])

  const toggleTrackLike = async (trackId: number) => {
    if (!isAuthenticated) return

    const currentlyLiked = Boolean(likedMap[trackId])
    setLikeStatus(trackId, !currentlyLiked)

    try {
      if (currentlyLiked) {
        await unlikeTrack(trackId)
      } else {
        await likeTrack(trackId)
      }
    } catch {
      setLikeStatus(trackId, currentlyLiked)
    }
  }

  if (!tracks.length) return null

  const queue = tracks.map((track) => ({
    track_id: track.track_id,
    title: track.title,
    artist_name: track.artist_name,
    cover_image_url: track.cover_image_url,
  }))

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="grid grid-cols-2 gap-4 max-[359px]:grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {tracks.map((track, index) => (
          <TrackCard
            key={track.track_id}
            title={track.title}
            artist={track.artist_name}
            imageUrl={track.cover_image_url}
            liked={Boolean(likedMap[track.track_id])}
            onPlay={() => setQueueAndPlay(queue, index)}
            onLike={() => toggleTrackLike(track.track_id)}
            onOpen={() => setQueueAndPlay(queue, index)}
          />
        ))}
      </div>
    </section>
  )
}

export function HomeTrackSections() {
  const [data, setData] = useState<HomeSectionsState>(initialState)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getHomeSections(8)
      .then(setData)
      .catch(() => setData(initialState))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-36 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-4 max-[359px]:grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="animate-pulse rounded-lg bg-muted" style={{ aspectRatio: "16/10" }} />
              <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <TrackRow title="Popular Songs" tracks={data.popularSongs} />
      <TrackRow title="Most Listened" tracks={data.mostListened} />
      <TrackRow title="Top Pick" tracks={data.topPick} />
      <PlaylistRow playlists={data.popularPlaylists} />
    </div>
  )
}
