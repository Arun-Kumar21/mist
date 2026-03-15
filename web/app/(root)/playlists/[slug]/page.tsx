"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Play } from "lucide-react"

import { getPlaylistById } from "@/lib/api/library"
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

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return "--"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export default function PlaylistDetailPage() {
  const params = useParams<{ slug: string }>()
  const playlistId = params?.slug
  const setQueueAndPlay = usePlayerStore((state) => state.setQueueAndPlay)

  const [playlistName, setPlaylistName] = React.useState("Playlist")
  const [tracks, setTracks] = React.useState<Array<{ position: number; track: { track_id: number; title: string | null; artist_name: string | null; duration_sec: number | null; cover_image_url: string | null } }>>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!playlistId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getPlaylistById(playlistId)
        if (cancelled) return
        setPlaylistName(data.playlist.name)
        setTracks(data.tracks)
      } catch {
        if (!cancelled) setError("Failed to load playlist.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [playlistId])

  const queue = React.useMemo(
    () => tracks.map((row) => ({
      track_id: row.track.track_id,
      title: row.track.title,
      artist_name: row.track.artist_name,
      cover_image_url: row.track.cover_image_url,
    })),
    [tracks]
  )

  return (
    <section className="space-y-6 p-3 sm:p-4 lg:p-6">
      <div className="rounded-2xl border border-border bg-card/60 p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Playlist</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{playlistName}</h1>
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
              <TableHead>#</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className="text-right">Play</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <TableRow key={`playlist-loading-${index}`}>
                  {Array.from({ length: 5 }).map((__, cellIndex) => (
                    <TableCell key={`playlist-loading-cell-${index}-${cellIndex}`}>
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : tracks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Playlist is empty.
                </TableCell>
              </TableRow>
            ) : (
              tracks.map((row, index) => (
                <TableRow key={`${row.track.track_id}-${row.position}-${index}`}>
                  <TableCell className="text-muted-foreground">{row.position + 1}</TableCell>
                  <TableCell className="max-w-56 truncate font-medium">{row.track.title ?? "Untitled"}</TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground">{row.track.artist_name ?? "Unknown artist"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDuration(row.track.duration_sec)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setQueueAndPlay(queue, index)}>
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
    </section>
  )
}
