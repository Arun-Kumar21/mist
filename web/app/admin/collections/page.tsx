"use client"

import * as React from "react"
import Image from "next/image"
import { GripVertical, Music2, Pencil, Plus, Trash2 } from "lucide-react"

import {
  addTopPick,
  CurationEntry,
  getCurationTopPicks,
  removeTopPick,
  updateTopPick,
} from "@/lib/api/admin"
import { searchTracks, TrackSearchResult } from "@/lib/api/tracks"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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

function normalizeTrackId(trackId: unknown): string {
  if (trackId === null || trackId === undefined) return ""
  return String(trackId).trim()
}

function upsertEntry(list: CurationEntry[], next: CurationEntry): CurationEntry[] {
  const nextId = normalizeTrackId(next.track_id)
  if (!nextId) return [...list, next]

  const existingIndex = list.findIndex((item) => normalizeTrackId(item.track_id) === nextId)
  if (existingIndex === -1) return [...list, next]

  const copy = [...list]
  copy[existingIndex] = next
  return copy
}

function dedupeEntries(list: CurationEntry[]): CurationEntry[] {
  const byTrackId = new Map<string, CurationEntry>()
  const withoutTrackId: CurationEntry[] = []

  for (const entry of list) {
    const id = normalizeTrackId(entry.track_id)
    if (!id) {
      withoutTrackId.push(entry)
      continue
    }
    byTrackId.set(id, entry)
  }

  return [...Array.from(byTrackId.values()), ...withoutTrackId]
}

// ─── Add / Edit dialog ────────────────────────────────────────────────────────

function CurationDialog({
  entry,
  open,
  onClose,
  onSaved,
}: {
  entry: CurationEntry | null
  open: boolean
  onClose: () => void
  onSaved: (e: CurationEntry, isNew: boolean) => void
}) {
  const isNew = entry === null
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<TrackSearchResult[]>([])
  const [selectedTrack, setSelectedTrack] = React.useState<TrackSearchResult | null>(null)
  const [displayOrder, setDisplayOrder] = React.useState(0)
  const [isActive, setIsActive] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open && entry) {
      setDisplayOrder(entry.display_order)
      setIsActive(entry.is_active)
      setError(null)
    } else if (open) {
      setDisplayOrder(0)
      setIsActive(true)
      setSelectedTrack(null)
      setSearchQuery("")
      setSearchResults([])
      setError(null)
    }
  }, [open, entry])

  React.useEffect(() => {
    if (!isNew || !searchQuery.trim()) { setSearchResults([]); return }
    const t = window.setTimeout(async () => {
      try {
        const res = await searchTracks(searchQuery)
        setSearchResults(res.tracks ?? [])
      } catch { setSearchResults([]) }
    }, 200)
    return () => clearTimeout(t)
  }, [searchQuery, isNew])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      if (isNew) {
        if (!selectedTrack) throw new Error("Select a track first.")
        const created = await addTopPick(selectedTrack.track_id, displayOrder, isActive)
        onSaved({ ...created, title: selectedTrack.title, artist_name: selectedTrack.artist_name, cover_image_url: selectedTrack.cover_image_url, genre_top: selectedTrack.genre_top }, true)
      } else {
        const updated = await updateTopPick(entry!.track_id, displayOrder, isActive)
        onSaved({ ...updated, title: entry!.title, artist_name: entry!.artist_name, cover_image_url: entry!.cover_image_url, genre_top: entry!.genre_top }, false)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {isNew ? "Add to Top Picks" : "Edit Curation Entry"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          {isNew && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Search track</Label>
              <Input
                placeholder="Type to search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-sm"
              />
              {searchResults.length > 0 && !selectedTrack && (
                <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
                  {searchResults.map((t) => (
                    <button
                      key={t.track_id}
                      type="button"
                      onClick={() => { setSelectedTrack(t); setSearchQuery(t.title ?? "") }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent"
                    >
                      {t.cover_image_url ? (
                        <Image src={t.cover_image_url} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded object-cover" unoptimized />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
                          <Music2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{t.artist_name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedTrack && (
                <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
                  {selectedTrack.cover_image_url ? (
                    <Image src={selectedTrack.cover_image_url} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded object-cover" unoptimized />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
                      <Music2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{selectedTrack.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{selectedTrack.artist_name}</p>
                  </div>
                  <button type="button" onClick={() => { setSelectedTrack(null); setSearchQuery("") }} className="text-xs text-muted-foreground hover:text-foreground">
                    ×
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs text-muted-foreground">Display order</Label>
              <Input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                id="curation-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 cursor-pointer"
              />
              <Label htmlFor="curation-active" className="cursor-pointer text-sm">Active</Label>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : isNew ? "Add" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteCurationDialog({
  entry, open, onClose, onDeleted,
}: { entry: CurationEntry | null; open: boolean; onClose: () => void; onDeleted: (id: number) => void }) {
  const [deleting, setDeleting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleDelete = async () => {
    if (!entry) return
    setDeleting(true)
    try {
      await removeTopPick(entry.track_id)
      onDeleted(entry.track_id)
      onClose()
    } catch { setError("Failed to remove from collection.") }
    finally { setDeleting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Remove from Top Picks?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">
            Remove <span className="font-medium text-foreground">{entry?.title ?? "this track"}</span> from the featured collection.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={deleting}>Cancel</Button>
            <Button
              size="sm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Removing…" : "Remove"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminCollectionsPage() {
  const [entries, setEntries] = React.useState<CurationEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [formTarget, setFormTarget] = React.useState<CurationEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<CurationEntry | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setFetchError(null)
      try {
        const data = await getCurationTopPicks(false)
        if (!cancelled) setEntries(dedupeEntries(data))
      } catch {
        if (!cancelled) setFetchError("Failed to load collections.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Top Picks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Curated tracks featured on the home feed.{" "}
            {loading ? "" : `${entries.length} entr${entries.length !== 1 ? "ies" : "y"}`}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { setFormTarget(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" />
          Add Track
        </Button>
      </div>

      {fetchError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {fetchError}
        </p>
      )}

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead className="w-12 text-xs font-medium text-muted-foreground">Cover</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Title</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Artist</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Genre</TableHead>
              <TableHead className="w-16 text-xs font-medium text-muted-foreground">Order</TableHead>
              <TableHead className="w-20 text-xs font-medium text-muted-foreground">Status</TableHead>
              <TableHead className="w-20 text-xs font-medium text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No tracks in collection yet.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((e, index) => (
                <TableRow key={`${normalizeTrackId(e.track_id) || "missing-track-id"}-${index}`}>
                  <TableCell className="pr-0">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                  </TableCell>
                  <TableCell>
                    {e.cover_image_url ? (
                      <Image src={e.cover_image_url} alt="" width={36} height={36} className="h-9 w-9 rounded object-cover" unoptimized />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded bg-muted">
                        <Music2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{e.title ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.artist_name ?? "—"}</TableCell>
                  <TableCell>
                    {e.genre_top ? (
                      <span className="rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                        {e.genre_top}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{e.display_order}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      e.is_active
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {e.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => { setFormTarget(e); setFormOpen(true) }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(e)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CurationDialog
        entry={formTarget}
        open={formOpen}
        onClose={() => { setFormOpen(false); setFormTarget(null) }}
        onSaved={(e, isNew) => {
          setEntries((prev) => upsertEntry(prev, e))
        }}
      />

      <DeleteCurationDialog
        entry={deleteTarget}
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(id) => setEntries((prev) => prev.filter((e) => e.track_id !== id))}
      />
    </div>
  )
}
