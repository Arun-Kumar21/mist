"use client"

import * as React from "react"
import Link from "next/link"

import { TrackGridSection } from "@/components/music/track-grid-section"
import { Button } from "@/components/ui/button"
import { getLikedTracks, type LikedTrack } from "@/lib/api/library"
import { useAuthStore } from "@/lib/stores/auth-store"

export default function LikedSongsPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [tracks, setTracks] = React.useState<LikedTrack[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!isAuthenticated) {
      setTracks([])
      setLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getLikedTracks(60, 0)
        if (!cancelled) setTracks(data)
      } catch {
        if (!cancelled) setError("Failed to load liked songs.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return (
      <section className="space-y-4 p-3 sm:p-4 lg:p-6">
        <div className="rounded-2xl border border-border bg-card/60 p-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Liked Songs</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Your Saved Favorites</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Sign in to see the tracks you saved and quickly jump back into them.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/login">Login to view likes</Link>
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6 p-3 sm:p-4 lg:p-6">
      <div className="rounded-2xl border border-border bg-card/60 p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Liked Songs</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Your Saved Favorites</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          All songs you explicitly liked, ordered from newest save to oldest.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 max-[359px]:grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={`likes-loading-${index}`} className="space-y-2">
              <div className="aspect-16/10 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : (
        <TrackGridSection
          title="Liked Songs"
          description="Unlike a track here and it disappears from this list immediately."
          tracks={tracks}
          emptyText="You haven't liked any songs yet."
          onLikeChange={(trackId, liked) => {
            if (!liked) {
              setTracks((current) => current.filter((track) => track.track_id !== trackId))
            }
          }}
        />
      )}
    </section>
  )
}
