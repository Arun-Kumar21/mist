"use client"

import { Heart, Play } from "lucide-react"
import { cn } from "@/lib/utils"

type TrackCardProps = {
  title?: string | null
  artist?: string | null
  imageUrl?: string | null
  className?: string
  liked?: boolean
  onPlay?: () => void
  onLike?: () => void
  onOpen?: () => void
}

export function TrackCard({ title, artist, imageUrl, className, liked = false, onPlay, onLike, onOpen }: TrackCardProps) {
  return (
    <article className={cn("group", className)}>
      <div
        className="relative cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-card"
        style={{ aspectRatio: "16/10" }}
        onClick={onOpen}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title || "Track cover"}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-zinc-700/50 to-zinc-900/60" />
        )}

        <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/35" />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onPlay?.()
          }}
          className="absolute bottom-2 left-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-black opacity-100 shadow-md transition-all duration-300 sm:bottom-3 sm:left-3 sm:h-9 sm:w-9 sm:translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100"
          aria-label="Play track"
        >
          <Play className="h-4 w-4" fill="currentColor" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onLike?.()
          }}
          className={cn(
            "absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center opacity-100 shadow-md backdrop-blur-sm transition-all duration-300 sm:bottom-3 sm:right-3 sm:h-9 sm:w-9 sm:translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100",
            liked
              ? "rounded-full bg-rose-500/90 text-white"
              : "rounded-full bg-black/60 text-white"
          )}
          aria-label="Like track"
        >
          <Heart className={cn("h-4 w-4", liked && "fill-current")} />
        </button>
      </div>

      <div className="mt-2 cursor-pointer" onClick={onOpen}>
        <h3 className="truncate hover:underline text-sm font-medium text-foreground">{title || "Untitled Track"}</h3>
        {artist ? <p className="truncate text-xs text-muted-foreground">{artist}</p> : null}
      </div>
    </article>
  )
}
