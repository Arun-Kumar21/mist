"use client"

import * as React from "react"
import Image from "next/image"
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronLeft, ChevronRight, Music2, Pencil, Star, Trash2 } from "lucide-react"

import { adminDeleteTrack, adminGetTracks, adminUpdateTrack, AdminTrack, UpdateTrackPayload } from "@/lib/api/admin"
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
import { cn } from "@/lib/utils"

function formatDuration(sec: number | null) {
  if (!sec) return "—"
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

function EditTrackDialog({
  track,
  open,
  onClose,
  onSaved,
}: {
  track: AdminTrack | null
  open: boolean
  onClose: () => void
  onSaved: (updated: AdminTrack) => void
}) {
  const [form, setForm] = React.useState<UpdateTrackPayload>({})
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (track) {
      setForm({
        title: track.title ?? "",
        artist_name: track.artist_name ?? "",
        album_title: track.album_title ?? "",
        genre_top: track.genre_top ?? "",
        is_featured_home: track.is_featured_home,
        home_feature_score: track.home_feature_score,
      })
      setError(null)
    }
  }, [track])

  const handleSave = async () => {
    if (!track) return
    setSaving(true)
    setError(null)
    try {
      const updated = await adminUpdateTrack(track.track_id, form)
      onSaved(updated)
      onClose()
    } catch {
      setError("Failed to save changes.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Edit Track</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          {(["title", "artist_name", "album_title", "genre_top"] as const).map((field) => (
            <div key={field} className="space-y-1.5">
              <Label htmlFor={field} className="text-xs capitalize text-muted-foreground">
                {field.replace("_", " ")}
              </Label>
              <Input
                id={field}
                value={(form[field] as string) ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          ))}

          <div className="flex items-center gap-4">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="home_feature_score" className="text-xs text-muted-foreground">
                Feature score
              </Label>
              <Input
                id="home_feature_score"
                type="number"
                value={form.home_feature_score ?? 0}
                onChange={(e) => setForm((p) => ({ ...p, home_feature_score: Number(e.target.value) }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                id="is_featured"
                type="checkbox"
                checked={!!form.is_featured_home}
                onChange={(e) => setForm((p) => ({ ...p, is_featured_home: e.target.checked }))}
                className="h-4 w-4 cursor-pointer"
              />
              <Label htmlFor="is_featured" className="text-sm cursor-pointer">
                Featured
              </Label>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete confirm dialog ────────────────────────────────────────────────────

function DeleteConfirmDialog({
  track,
  open,
  onClose,
  onDeleted,
}: {
  track: AdminTrack | null
  open: boolean
  onClose: () => void
  onDeleted: (trackId: number) => void
}) {
  const [deleting, setDeleting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleDelete = async () => {
    if (!track) return
    setDeleting(true)
    setError(null)
    try {
      await adminDeleteTrack(track.track_id)
      onDeleted(track.track_id)
      onClose()
    } catch {
      setError("Failed to delete track.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Delete track?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">
            This will permanently delete{" "}
            <span className="font-medium text-foreground">
              {track?.title ?? "this track"}
            </span>{" "}
            and all associated S3 files. This cannot be undone.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={deleting}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [tracks, setTracks] = React.useState<AdminTrack[]>([])
  const [loading, setLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)

  const [editTarget, setEditTarget] = React.useState<AdminTrack | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<AdminTrack | null>(null)

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  // Load all tracks (fetch pages until done)
  React.useEffect(() => {
    let cancelled = false
    const fetchAll = async () => {
      setLoading(true)
      setFetchError(null)
      try {
        const all: AdminTrack[] = []
        let skip = 0
        const pageSize = 100
        while (true) {
          const res = await adminGetTracks(pageSize, skip)
          all.push(...res.tracks)
          if (res.tracks.length < pageSize) break
          skip += pageSize
        }
        if (!cancelled) setTracks(all)
      } catch {
        if (!cancelled) setFetchError("Failed to load tracks.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [])

  const columns: ColumnDef<AdminTrack>[] = React.useMemo(
    () => [
      {
        accessorKey: "track_id",
        header: "ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">#{row.getValue("track_id")}</span>
        ),
        size: 60,
      },
      {
        id: "cover",
        header: "",
        cell: ({ row }) => {
          const url = row.original.cover_image_url
          return url ? (
            <Image
              src={url}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded bg-muted">
              <Music2 className="h-4 w-4 text-muted-foreground" />
            </div>
          )
        },
        size: 52,
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 text-left"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Title <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-medium text-foreground line-clamp-1">
            {row.getValue("title") ?? <span className="text-muted-foreground italic">Untitled</span>}
          </span>
        ),
      },
      {
        accessorKey: "artist_name",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 text-left"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Artist <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground line-clamp-1">
            {row.getValue("artist_name") ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "album_title",
        header: "Album",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground line-clamp-1">
            {row.getValue("album_title") ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "genre_top",
        header: "Genre",
        cell: ({ row }) => {
          const g = row.getValue("genre_top") as string | null
          return g ? (
            <span className="rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
              {g}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
      },
      {
        accessorKey: "duration_sec",
        header: "Duration",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {formatDuration(row.getValue("duration_sec"))}
          </span>
        ),
        size: 80,
      },
      {
        accessorKey: "listens",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 text-left"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Listens <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {(row.getValue("listens") as number | null)?.toLocaleString() ?? "—"}
          </span>
        ),
        size: 90,
      },
      {
        accessorKey: "is_featured_home",
        header: "Featured",
        cell: ({ row }) =>
          row.getValue("is_featured_home") ? (
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        size: 80,
      },
      {
        accessorKey: "processing_status",
        header: "Status",
        cell: ({ row }) => {
          const s = row.getValue("processing_status") as string | null
          return (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs capitalize",
                s === "success" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                s === "processing" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                s === "error" && "bg-destructive/10 text-destructive",
                !s && "text-muted-foreground"
              )}
            >
              {s ?? "—"}
            </span>
          )
        },
        size: 90,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setEditTarget(row.original)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
        size: 80,
      },
    ],
    []
  )

  const table = useReactTable({
    data: tracks,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

  const titleFilter = (table.getColumn("title")?.getFilterValue() as string) ?? ""

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Songs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading ? "Loading…" : `${tracks.length} total tracks`}
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by title…"
          value={titleFilter}
          onChange={(e) => table.getColumn("title")?.setFilterValue(e.target.value)}
          className="h-8 max-w-xs text-sm"
        />
        <span className="text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length} result{table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Error */}
      {fetchError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {fetchError}
        </p>
      )}

      {/* Table */}
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    style={{ width: h.column.columnDef.size }}
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No tracks found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="group">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Edit dialog */}
      <EditTrackDialog
        track={editTarget}
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        onSaved={(updated) =>
          setTracks((prev) => prev.map((t) => (t.track_id === updated.track_id ? updated : t)))
        }
      />

      {/* Delete dialog */}
      <DeleteConfirmDialog
        track={deleteTarget}
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(id) => setTracks((prev) => prev.filter((t) => t.track_id !== id))}
      />
    </div>
  )
}
