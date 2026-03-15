"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Music2, Plus, Search, Trash2 } from "lucide-react"

import { addTrackToPlaylist, createPlaylist } from "@/lib/api/library"
import { searchTracks, type TrackSearchResult } from "@/lib/api/tracks"
import { useAuthStore } from "@/lib/stores/auth-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function CreatePlaylistPage() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  const [results, setResults] = React.useState<TrackSearchResult[]>([])
  const [selectedTracks, setSelectedTracks] = React.useState<TrackSearchResult[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!isAuthenticated) return

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
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [query, isAuthenticated])

  const addTrack = (track: TrackSearchResult) => {
    setSelectedTracks((current) => {
      if (current.some((item) => item.track_id === track.track_id)) return current
      return [...current, track]
    })
  }

  const removeTrack = (trackId: number) => {
    setSelectedTracks((current) => current.filter((track) => track.track_id !== trackId))
  }

  const handleCreate = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Playlist name is required.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const playlist = await createPlaylist({
        name: trimmedName,
        description: description.trim() || undefined,
        is_public: false,
      })

      for (const track of selectedTracks) {
        try {
          await addTrackToPlaylist(playlist.playlist_id, track.track_id)
        } catch {
          // Continue adding others even if one fails.
        }
      }

      router.push(`/playlists/${playlist.playlist_id}`)
    } catch {
      setError("Failed to create playlist.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <section className="space-y-4 p-3 sm:p-4 lg:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Create Playlist</h1>
        <p className="text-sm text-muted-foreground">Login to create playlists.</p>
      </section>
    )
  }

  const selectedIds = new Set(selectedTracks.map((track) => track.track_id))

  return (
    <section className="space-y-6 p-3 sm:p-4 lg:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create Playlist</h1>
        <p className="text-sm text-muted-foreground">
          Give your playlist a name and add songs using search.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
          <div className="space-y-2">
            <Label htmlFor="playlist-name">Playlist Name</Label>
            <Input
              id="playlist-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Late Night Loop"
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="playlist-description">Description (optional)</Label>
            <Input
              id="playlist-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Songs I keep replaying this week"
              maxLength={240}
            />
          </div>

          <Button onClick={handleCreate} disabled={submitting || !name.trim()} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {submitting ? "Creating..." : "Create Playlist"}
          </Button>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
          <div className="space-y-2">
            <Label htmlFor="track-search">Search Songs</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="track-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title, artist, genre"
                className="pl-8"
              />
            </div>
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border/70 bg-background/70 p-2">
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
                    onClick={() => addTrack(track)}
                    disabled={selectedIds.has(track.track_id)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Selected Songs ({selectedTracks.length})</p>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border/70 bg-background/70 p-2">
              {selectedTracks.length === 0 ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">No songs selected yet.</p>
              ) : (
                selectedTracks.map((track) => (
                  <div key={track.track_id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Music2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{track.title ?? "Untitled"}</p>
                        <p className="truncate text-xs text-muted-foreground">{track.artist_name ?? "Unknown artist"}</p>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeTrack(track.track_id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
