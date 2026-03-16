"use client"

import * as React from "react"

import { TrackGridSection, type GridTrack } from "@/components/music/track-grid-section"
import { Button } from "@/components/ui/button"
import { getHomeSections } from "@/lib/api/home"
import { getTracks, type TrackListItem } from "@/lib/api/tracks"

type ExploreState = {
  curated: GridTrack[]
  popular: GridTrack[]
  recent: GridTrack[]
  allTracks: TrackListItem[]
}

const initialState: ExploreState = {
  curated: [],
  popular: [],
  recent: [],
  allTracks: [],
}

export default function ExplorePage() {
  const [data, setData] = React.useState<ExploreState>(initialState)
  const [selectedGenre, setSelectedGenre] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [home, tracksResponse] = await Promise.all([
          getHomeSections(8),
          getTracks(60, 0),
        ])

        if (cancelled) return

        const allTracks = tracksResponse.tracks
        const recent = [...allTracks]
          .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
          .slice(0, 10)

        setData({
          curated: home.topPick,
          popular: [...home.popularSongs, ...home.mostListened].slice(0, 10),
          recent,
          allTracks,
        })
      } catch {
        if (!cancelled) setError("Failed to load explore content.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const topGenres = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const track of data.allTracks) {
      const genre = track.genre_top?.trim()
      if (!genre) continue
      counts.set(genre, (counts.get(genre) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([genre]) => genre)
  }, [data.allTracks])

  const genreTracks = React.useMemo(() => {
    if (!selectedGenre) return []
    return data.allTracks.filter((track) => track.genre_top === selectedGenre).slice(0, 10)
  }, [data.allTracks, selectedGenre])

  return (
    <section className="space-y-8 p-3 sm:p-4 lg:p-6">
      <div className="rounded-2xl border border-border bg-linear-to-br from-card to-muted/30 p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Explore</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Find Your Next Loop</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          A mix of curated picks, high-rotation songs, fresh additions, and genre pockets worth digging into.
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
            <div key={`explore-loading-${index}`} className="space-y-2">
              <div className="aspect-16/10 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <TrackGridSection
            title="Curated Picks"
            description="Manually selected tracks worth starting with."
            tracks={data.curated}
          />

          <TrackGridSection
            title="Popular Right Now"
            description="Songs already pulling serious replay numbers across the app."
            tracks={data.popular}
          />

          <div className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">Browse By Genre</h2>
              <p className="text-sm text-muted-foreground">Quick jump into a lane and skim a focused slice.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {topGenres.map((genre) => (
                <Button
                  key={genre}
                  variant={selectedGenre === genre ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedGenre((current) => (current === genre ? null : genre))}
                >
                  {genre}
                </Button>
              ))}
            </div>
          </div>

          {selectedGenre ? (
            <TrackGridSection
              title={`${selectedGenre} Picks`}
              description="A genre-focused pass from the wider catalogue."
              tracks={genreTracks}
              emptyText="No tracks found for this genre yet."
            />
          ) : null}

          <TrackGridSection
            title="Fresh Additions"
            description="Newest tracks in the catalogue, sorted by creation time."
            tracks={data.recent}
          />
        </>
      )}
    </section>
  )
}
