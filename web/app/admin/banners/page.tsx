"use client"

import * as React from "react"
import Image from "next/image"
import { ExternalLink, Image as ImageIcon, Pencil, Plus, Trash2 } from "lucide-react"

import {
  Banner,
  createBanner,
  deleteBanner,
  getAllBanners,
  replaceBannerImage,
  updateBanner,
} from "@/lib/api/banners"
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

// ─── Form dialog (create & edit) ─────────────────────────────────────────────

type BannerFormProps = {
  banner: Banner | null  // null = create mode
  open: boolean
  onClose: () => void
  onSaved: (b: Banner, isNew: boolean) => void
}

function BannerFormDialog({ banner, open, onClose, onSaved }: BannerFormProps) {
  const isCreate = banner === null
  const [form, setForm] = React.useState({
    title: "",
    subtitle: "",
    link_url: "",
    display_order: 0,
    is_active: true,
  })
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const imgRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setForm({
        title: banner?.title ?? "",
        subtitle: banner?.subtitle ?? "",
        link_url: banner?.link_url ?? "",
        display_order: banner?.display_order ?? 0,
        is_active: banner?.is_active ?? true,
      })
      setImageFile(null)
      setImagePreview(banner?.image_url ?? null)
      setError(null)
    }
  }, [open, banner])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    setImagePreview(URL.createObjectURL(f))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      if (isCreate) {
        if (!imageFile) throw new Error("Image is required for new banners.")
        const created = await createBanner({ image: imageFile, ...form })
        onSaved(created, true)
      } else {
        const updated = await updateBanner(banner!.banner_id, form)
        let final = updated
        if (imageFile) {
          final = await replaceBannerImage(banner!.banner_id, imageFile)
        }
        onSaved(final, false)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save banner.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {isCreate ? "Create Banner" : "Edit Banner"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          {/* Image */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => imgRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && imgRef.current?.click()}
            className="relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30 transition-colors hover:bg-muted/50"
          >
            <input ref={imgRef} type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
            {imagePreview ? (
              <Image src={imagePreview} alt="" fill className="object-cover" unoptimized />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <ImageIcon className="h-6 w-6" />
                <span className="text-xs">{isCreate ? "Click to add image" : "Click to replace image"}</span>
              </div>
            )}
            {imagePreview && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                <span className="text-xs font-medium text-white">Change image</span>
              </div>
            )}
          </div>

          {(["title", "subtitle", "link_url"] as const).map((field) => (
            <div key={field} className="space-y-1.5">
              <Label className="text-xs capitalize text-muted-foreground">{field.replace("_", " ")}</Label>
              <Input
                value={form[field]}
                onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                className="h-8 text-sm"
                placeholder={field === "link_url" ? "https://…" : `Enter ${field.replace("_", " ")}…`}
              />
            </div>
          ))}

          <div className="flex items-center gap-4">
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs text-muted-foreground">Display order</Label>
              <Input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm((p) => ({ ...p, display_order: Number(e.target.value) }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                id="banner-active"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                className="h-4 w-4 cursor-pointer"
              />
              <Label htmlFor="banner-active" className="cursor-pointer text-sm">Active</Label>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : isCreate ? "Create" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteBannerDialog({
  banner, open, onClose, onDeleted,
}: { banner: Banner | null; open: boolean; onClose: () => void; onDeleted: (id: number) => void }) {
  const [deleting, setDeleting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleDelete = async () => {
    if (!banner) return
    setDeleting(true)
    try {
      await deleteBanner(banner.banner_id)
      onDeleted(banner.banner_id)
      onClose()
    } catch {
      setError("Failed to delete banner.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Delete banner?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">
            This will permanently delete{" "}
            <span className="font-medium text-foreground">{banner?.title ?? "this banner"}</span> and its image.
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
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminBannersPage() {
  const [banners, setBanners] = React.useState<Banner[]>([])
  const [loading, setLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [formTarget, setFormTarget] = React.useState<Banner | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<Banner | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setFetchError(null)
      try {
        const data = await getAllBanners()
        if (!cancelled) setBanners(data)
      } catch {
        if (!cancelled) setFetchError("Failed to load banners.")
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
          <h1 className="text-2xl font-bold tracking-tight">Banners</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Loading…" : `${banners.length} banner${banners.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { setFormTarget(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" />
          New Banner
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
              <TableHead className="w-16 text-xs font-medium text-muted-foreground">Image</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Title</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Subtitle</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Link</TableHead>
              <TableHead className="w-16 text-xs font-medium text-muted-foreground">Order</TableHead>
              <TableHead className="w-20 text-xs font-medium text-muted-foreground">Status</TableHead>
              <TableHead className="w-20 text-xs font-medium text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : banners.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No banners yet.
                </TableCell>
              </TableRow>
            ) : (
              banners.map((b) => (
                <TableRow key={b.banner_id}>
                  <TableCell>
                    {b.image_url ? (
                      <Image
                        src={b.image_url}
                        alt=""
                        width={56}
                        height={32}
                        className="h-8 w-14 rounded object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-8 w-14 items-center justify-center rounded bg-muted">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{b.title ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.subtitle ?? "—"}</TableCell>
                  <TableCell>
                    {b.link_url ? (
                      <a
                        href={b.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Link <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{b.display_order}</TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        b.is_active
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {b.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => { setFormTarget(b); setFormOpen(true) }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(b)}
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

      <BannerFormDialog
        banner={formTarget}
        open={formOpen}
        onClose={() => { setFormOpen(false); setFormTarget(null) }}
        onSaved={(b, isNew) => {
          setBanners((prev) =>
            isNew ? [...prev, b] : prev.map((x) => (x.banner_id === b.banner_id ? b : x))
          )
        }}
      />

      <DeleteBannerDialog
        banner={deleteTarget}
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(id) => setBanners((prev) => prev.filter((b) => b.banner_id !== id))}
      />
    </div>
  )
}
