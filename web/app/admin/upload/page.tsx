"use client"

import * as React from "react"
import Image from "next/image"
import { CheckCircle2, FileAudio, ImageIcon, Upload, X } from "lucide-react"

import { adminUpdateTrackCover, completeUpload, getUploadJob, requestUpload } from "@/lib/api/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type UploadStage = "idle" | "uploading" | "processing" | "done" | "error"

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const ACCEPTED_AUDIO = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/flac", "audio/aac", "audio/ogg"]
const ACCEPTED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/avif"]

export default function AdminUploadPage() {
  const [audioFile, setAudioFile] = React.useState<File | null>(null)
  const [coverFile, setCoverFile] = React.useState<File | null>(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = React.useState<string | null>(null)
  const [stage, setStage] = React.useState<UploadStage>("idle")
  const [progress, setProgress] = React.useState(0)
  const [jobId, setJobId] = React.useState<string | null>(null)
  const [jobStatus, setJobStatus] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const audioInputRef = React.useRef<HTMLInputElement>(null)
  const coverInputRef = React.useRef<HTMLInputElement>(null)

  const [meta, setMeta] = React.useState({
    title: "",
    artist_name: "",
    album_title: "",
    genre_top: "",
  })

  React.useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(coverFile)
    setCoverPreviewUrl(url)

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [coverFile])

  const reset = () => {
    setAudioFile(null)
    setCoverFile(null)
    setStage("idle")
    setProgress(0)
    setJobId(null)
    setJobStatus(null)
    setError(null)
    setMeta({ title: "", artist_name: "", album_title: "", genre_top: "" })
  }

  const handleAudioDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (ACCEPTED_AUDIO.includes(file.type) || file.name.match(/\.(mp3|wav|flac|aac|ogg|m4a)$/i))) {
      setAudioFile(file)
      if (!meta.title) setMeta((p) => ({ ...p, title: file.name.replace(/\.[^.]+$/, "") }))
    }
  }

  const handleUpload = async () => {
    if (!audioFile) return
    setStage("uploading")
    setProgress(0)
    setError(null)

    try {
      // 1. Request presigned upload URL
      const uploadReq = await requestUpload({
        filename: audioFile.name,
        filesize: audioFile.size,
        contentType: audioFile.type || "audio/mpeg",
        metadata: meta,
      })

      setJobId(uploadReq.jobId)

      // 2. Upload directly to S3 via presigned POST
      const formData = new FormData()
      Object.entries(uploadReq.fields).forEach(([k, v]) => formData.append(k, v))
      formData.append("file", audioFile)

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        })
        xhr.addEventListener("load", () => {
          xhr.status < 400 ? resolve() : reject(new Error(`S3 upload failed: ${xhr.status}`))
        })
        xhr.addEventListener("error", () => reject(new Error("Network error during upload.")))
        xhr.open("POST", uploadReq.uploadUrl)
        xhr.send(formData)
      })

      setProgress(100)
      setStage("processing")

      // 3. Notify backend that upload is complete
      await completeUpload(uploadReq.jobId, meta)

      // 4. Poll job status
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        try {
          const job = await getUploadJob(uploadReq.jobId)
          setJobStatus(job.status)

          if (job.status === "completed") {
            clearInterval(poll)

            // Optional: attach cover once processing created the track row.
            if (coverFile && job.track?.track_id) {
              await adminUpdateTrackCover(job.track.track_id, coverFile)
            }

            setStage("done")
          } else if (job.status === "error" || job.status === "failed") {
            clearInterval(poll)
            setError(job.error || "Processing failed. Check the job logs.")
            setStage("error")
          } else if (attempts > 60) {
            clearInterval(poll)
            setStage("done") // Assume success after 5 min
          }
        } catch {
          // keep polling silently
        }
      }, 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.")
      setStage("error")
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Song</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload an audio file to be processed and added to the catalogue.
        </p>
      </div>

      {stage === "done" ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-3">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="font-semibold text-foreground">Upload complete!</p>
          <p className="text-sm text-muted-foreground">
            The audio is being processed. It will appear in the song catalogue once processing finishes.
          </p>
          <Button variant="outline" size="sm" onClick={reset} className="mt-2">
            Upload another
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Audio file drop zone */}
          <div
            role="button"
            tabIndex={0}
            onDrop={handleAudioDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => audioInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && audioInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors cursor-pointer ${
              audioFile
                ? "border-foreground/30 bg-muted/30"
                : "border-border hover:border-foreground/30 hover:bg-muted/20"
            }`}
          >
            <input
              ref={audioInputRef}
              type="file"
              accept=".mp3,.wav,.flac,.aac,.ogg,.m4a,audio/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  setAudioFile(f)
                  if (!meta.title) setMeta((p) => ({ ...p, title: f.name.replace(/\.[^.]+$/, "") }))
                }
              }}
            />
            {audioFile ? (
              <>
                <FileAudio className="h-8 w-8 text-foreground/60" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">{audioFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(audioFile.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setAudioFile(null) }}
                  className="absolute right-3 top-3 rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Drop audio file here</p>
                  <p className="text-xs text-muted-foreground">MP3, WAV, FLAC, AAC, OGG — click to browse</p>
                </div>
              </>
            )}
          </div>

          {/* Metadata */}
          <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Metadata</p>

            <div className="flex items-start gap-3">
              <Label className="w-28 shrink-0 pt-2 text-xs text-muted-foreground capitalize">
                cover image
              </Label>
              <div className="w-full space-y-2">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={stage !== "idle"}
                  className="flex w-full items-center justify-center rounded-md border border-dashed border-border bg-background px-3 py-4 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.avif,image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      if (!ACCEPTED_IMAGE.includes(f.type)) {
                        setError("Cover must be JPEG, PNG, WebP, or AVIF.")
                        return
                      }
                      setError(null)
                      setCoverFile(f)
                    }}
                  />
                  {coverFile ? (
                    <div className="relative h-28 w-full overflow-hidden rounded border border-border/70">
                      {coverPreviewUrl ? (
                        <Image
                          src={coverPreviewUrl}
                          alt="Cover preview"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
                        {coverFile.name}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <ImageIcon className="h-4 w-4" />
                      Upload cover image (optional)
                    </div>
                  )}
                </button>
                {coverFile && (
                  <button
                    type="button"
                    onClick={() => setCoverFile(null)}
                    disabled={stage !== "idle"}
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Remove selected cover
                  </button>
                )}
              </div>
            </div>

            {(["title", "artist_name", "album_title", "genre_top"] as const).map((field) => (
              <div key={field} className="flex items-center gap-3">
                <Label htmlFor={`meta-${field}`} className="w-28 shrink-0 text-xs text-muted-foreground capitalize">
                  {field.replace("_", " ")}
                </Label>
                <Input
                  id={`meta-${field}`}
                  value={meta[field]}
                  onChange={(e) => setMeta((p) => ({ ...p, [field]: e.target.value }))}
                  placeholder={`Enter ${field.replace("_", " ")}…`}
                  className="h-8 text-sm"
                  disabled={stage !== "idle"}
                />
              </div>
            ))}
          </div>

          {/* Progress */}
          {stage === "uploading" && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uploading…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-foreground transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          {stage === "processing" && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-4 py-3">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-foreground" />
              <span className="text-sm text-muted-foreground">
                Processing audio… {jobStatus ? `(${jobStatus})` : ""}
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {stage === "error" && (
              <Button variant="outline" size="sm" onClick={reset}>
                Reset
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleUpload}
              disabled={!audioFile || stage !== "idle"}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
