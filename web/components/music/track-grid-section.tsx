"use client"

import * as React from "react"

import { TrackCard } from "@/components/track-card"
import { getTrackLikeStatus, likeTrack, unlikeTrack } from "@/lib/api/player"
import { useAuthStore } from "@/lib/stores/auth-store"
import { usePlayerStore } from "@/lib/stores/player-store"
import { useTrackLikesStore } from "@/lib/stores/track-likes-store"

export type GridTrack = {
  track_id: number
  title: string | null
  artist_name: string | null
  cover_image_url: string | null
}

type TrackGridSectionProps<TTrack extends GridTrack> = {
  title: string
  description?: string
  tracks: TTrack[]
  emptyText?: string
  onLikeChange?: (trackId: number, liked: boolean) => void
}

export function TrackGridSection<TTrack extends GridTrack>({
  title,
  description,
  tracks,
  emptyText = "No songs yet.",
  onLikeChange,
}: TrackGridSectionProps<TTrack>) {
  const setQueueAndPlay = usePlayerStore((state) => state.setQueueAndPlay)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const likedMap = useTrackLikesStore((state) => state.likes)
  const setManyLikeStatuses = useTrackLikesStore((state) => state.setManyLikeStatuses)
  const setLikeStatus = useTrackLikesStore((state) => state.setLikeStatus)
  const clearLikes = useTrackLikesStore((state) => state.clearLikes)

  React.useEffect(() => {
    let cancelled = false

    if (!isAuthenticated) {
      clearLikes()
      return
    }

    const uniqueTrackIds = Array.from(new Set(tracks.map((track) => track.track_id))).filter(Boolean)
    if (!uniqueTrackIds.length) return

    const loadLikes = async () => {
      const entries = await Promise.all(
        uniqueTrackIds.map(async (trackId) => {
          try {
            const response = await getTrackLikeStatus(trackId)
            return [trackId, response.liked] as const
          } catch {
            return [trackId, false] as const
          }
        })
      )

      if (cancelled) return
      setManyLikeStatuses(entries.map((entry) => [entry[0], entry[1]]))
    }

    void loadLikes()

    return () => {
      cancelled = true
    }
  }, [tracks, isAuthenticated, clearLikes, setManyLikeStatuses])

  const queue = React.useMemo(
    () => tracks.map((track) => ({
      track_id: track.track_id,
      title: track.title,
      artist_name: track.artist_name,
      cover_image_url: track.cover_image_url,
    })),
    [tracks]
  )

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
      onLikeChange?.(trackId, !currentlyLiked)
    } catch {
      setLikeStatus(trackId, currentlyLiked)
    }
  }

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>

      {!tracks.length ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 max-[359px]:grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {tracks.map((track, index) => (
            <TrackCard
              key={track.track_id}
              title={track.title}
              artist={track.artist_name}
              imageUrl={track.cover_image_url}
              liked={Boolean(likedMap[track.track_id])}
              onPlay={() => setQueueAndPlay(queue, index)}
              onLike={() => void toggleTrackLike(track.track_id)}
              onOpen={() => setQueueAndPlay(queue, index)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
