"use client"

import * as React from "react"

import { TrackGridSection, type GridTrack } from "@/components/music/track-grid-section"
import { getHomeSections } from "@/lib/api/home"

type TrendingState = {
  popular: GridTrack[]
}

const initialState: TrendingState = {
  popular: [],
}

export default function TrendingPage() {
  const [data, setData] = React.useState<TrendingState>(initialState)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [home] = await Promise.all([
          getHomeSections(8),
        ])

        if (cancelled) return

        const popular = [...home.popularSongs, ...home.mostListened]
          .filter((track, index, list) => list.findIndex((item) => item.track_id === track.track_id) === index)
          .slice(0, 20)

        setData({ popular })
      } catch {
        if (!cancelled) setError("Failed to load trending tracks.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="space-y-8 p-3 sm:p-4 lg:p-6">
      <div className="rounded-2xl border border-border bg-linear-to-br from-card to-muted/30 p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Trending</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">What Everyone Is Playing</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Real-time momentum from the platform: the songs getting the most listens right now.
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
            <div key={`trending-loading-${index}`} className="space-y-2">
              <div className="aspect-16/10 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : (
        <TrackGridSection
          title="Popular Right Now"
          description="Top tracks gaining momentum across the platform."
          tracks={data.popular}
          emptyText="No trending tracks available yet."
        />
      )}

    </section>
  )
}
