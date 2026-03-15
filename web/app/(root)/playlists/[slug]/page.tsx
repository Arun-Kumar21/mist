"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Loader2, Play, Plus, Save, Search, Trash2 } from "lucide-react"

import { addTrackToPlaylist, getPlaylistById, removeTrackFromPlaylist, updatePlaylist } from "@/lib/api/library"
import { searchTracks, type TrackSearchResult } from "@/lib/api/tracks"
import { usePlayerStore } from "@/lib/stores/player-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  const [playlistDescription, setPlaylistDescription] = React.useState("")
  const [isPublic, setIsPublic] = React.useState(false)
  const [isOwner, setIsOwner] = React.useState(false)
  const [savingDetails, setSavingDetails] = React.useState(false)

  const [query, setQuery] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  const [results, setResults] = React.useState<TrackSearchResult[]>([])

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
        setPlaylistDescription(data.playlist.description ?? "")
        setIsPublic(data.playlist.is_public)
        setIsOwner(data.is_owner)
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

  React.useEffect(() => {
    if (!isOwner) {
      setResults([])
      return
    }

    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setSearching(false)
      return
    }

    let cancelled = false
    setSearching(true)

    const timeoutId = window.setTimeout(async () => {
      try {
        const data = await searchTracks(trimmed)
        if (cancelled) return
        setResults(data.tracks ?? [])
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [query, isOwner])

  const queue = React.useMemo(
    () => tracks.map((row) => ({
      track_id: row.track.track_id,
      title: row.track.title,
      artist_name: row.track.artist_name,
      cover_image_url: row.track.cover_image_url,
    })),
    [tracks]
  )

  const trackIds = React.useMemo(() => new Set(tracks.map((row) => row.track.track_id)), [tracks])

  const handleSaveDetails = async () => {
    if (!playlistId || !isOwner) return
    const trimmedName = playlistName.trim()
    if (!trimmedName) {
      setError("Playlist name cannot be empty.")
      return
    }

    setSavingDetails(true)
    setError(null)
    try {
      const updated = await updatePlaylist(playlistId, {
        name: trimmedName,
        description: playlistDescription.trim() || null,
        is_public: isPublic,
      })
      setPlaylistName(updated.name)
      setPlaylistDescription(updated.description ?? "")
      setIsPublic(updated.is_public)
    } catch {
      setError("Failed to update playlist details.")
    } finally {
      setSavingDetails(false)
    }
  }

  const handleAddTrack = async (track: TrackSearchResult) => {
    if (!playlistId || !isOwner) return

    try {
      await addTrackToPlaylist(playlistId, track.track_id)
      setTracks((current) => [
        ...current,
        {
          position: current.length,
          track: {
            track_id: track.track_id,
            title: track.title,
            artist_name: track.artist_name,
            duration_sec: track.duration_sec,
            cover_image_url: track.cover_image_url,
          },
        },
      ])
    } catch {
      setError("Failed to add song to playlist.")
    }
  }

  const handleRemoveTrack = async (trackId: number) => {
    if (!playlistId || !isOwner) return
    try {
      await removeTrackFromPlaylist(playlistId, trackId)
      setTracks((current) =>
        current
          .filter((row) => row.track.track_id !== trackId)
          .map((row, index) => ({ ...row, position: index }))
      )
    } catch {
      setError("Failed to remove song from playlist.")
    }
  }

  return (
    <section className="space-y-6 p-3 sm:p-4 lg:p-6">
      <div className="rounded-2xl border border-border bg-card/60 p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Playlist</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{playlistName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isPublic ? "Public playlist" : "Private playlist"}
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isOwner ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Edit Playlist</h2>
            <div className="space-y-2">
              <Label htmlFor="playlist-name">Name</Label>
              <Input
                id="playlist-name"
                value={playlistName}
                onChange={(event) => setPlaylistName(event.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="playlist-description">Description</Label>
              <Input
                id="playlist-description"
                value={playlistDescription}
                onChange={(event) => setPlaylistDescription(event.target.value)}
                maxLength={240}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="playlist-public"
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
                className="h-4 w-4 cursor-pointer"
              />
              <Label htmlFor="playlist-public" className="cursor-pointer text-sm text-muted-foreground">
                Make playlist public
              </Label>
            </div>
            <Button onClick={handleSaveDetails} disabled={savingDetails} className="gap-2">
              {savingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingDetails ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Add Songs</h2>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search songs to add"
                className="pl-8"
              />
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border/70 bg-background/70 p-2">
              {searching ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">Searching...</p>
              ) : results.length === 0 ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">Type to search songs.</p>
              ) : (
                results.map((track) => (
                  <div key={track.track_id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{track.title ?? "Untitled"}</p>
                      <p className="truncate text-xs text-muted-foreground">{track.artist_name ?? "Unknown artist"}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddTrack(track)}
                      disabled={trackIds.has(track.track_id)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
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
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setQueueAndPlay(queue, index)}>
                        <Play className="h-3.5 w-3.5" />
                        Play
                      </Button>
                      {isOwner ? (
                        <Button variant="ghost" size="icon-sm" onClick={() => handleRemoveTrack(row.track.track_id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
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
