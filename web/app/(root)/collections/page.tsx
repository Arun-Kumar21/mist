"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Heart, Play } from "lucide-react"

import { getTracks, type TrackListItem } from "@/lib/api/tracks"
import { usePlayerStore } from "@/lib/stores/player-store"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const PAGE_SIZE = 12

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return "--"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export default function CollectionsPage() {
  const setQueueAndPlay = usePlayerStore((state) => state.setQueueAndPlay)
  const [tracks, setTracks] = React.useState<TrackListItem[]>([])
  const [page, setPage] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getTracks(PAGE_SIZE, page * PAGE_SIZE)
        if (cancelled) return
        setTracks(data.tracks)
        setHasNextPage(data.tracks.length === PAGE_SIZE)
      } catch {
        if (!cancelled) setError("Failed to load library songs.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [page])

  const queue = React.useMemo(
    () => tracks.map((track) => ({
      track_id: track.track_id,
      title: track.title,
      artist_name: track.artist_name,
      cover_image_url: track.cover_image_url,
    })),
    [tracks]
  )

  return (
    <section className="space-y-6 p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Library</p>
          <h1 className="text-2xl font-semibold tracking-tight">All Songs</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Browse the full catalogue in a clean table view. Use liked songs for your saved favorites.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2 self-start sm:self-auto">
          <Link href="/collections/liked">
            <Heart className="h-3.5 w-3.5" />
            Liked Songs
          </Link>
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Album</TableHead>
              <TableHead>Genre</TableHead>
              <TableHead>Listens</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className="text-right">Play</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: PAGE_SIZE }).map((_, index) => (
                <TableRow key={`loading-${index}`}>
                  {Array.from({ length: 7 }).map((__, cellIndex) => (
                    <TableCell key={`loading-cell-${index}-${cellIndex}`}>
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : tracks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No songs available.
                </TableCell>
              </TableRow>
            ) : (
              tracks.map((track, index) => (
                <TableRow key={track.track_id}>
                  <TableCell className="max-w-56 truncate font-medium">{track.title ?? "Untitled"}</TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground">{track.artist_name ?? "Unknown artist"}</TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground">{track.album_title ?? "--"}</TableCell>
                  <TableCell>
                    {track.genre_top ? (
                      <span className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                        {track.genre_top}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{track.listens?.toLocaleString() ?? "0"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDuration(track.duration_sec)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setQueueAndPlay(queue, index)}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Play
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Page {page + 1}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0 || loading}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setPage((current) => current + 1)}
            disabled={!hasNextPage || loading}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </section>
  )
}
