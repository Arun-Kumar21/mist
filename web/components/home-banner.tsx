"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, ListMusic } from "lucide-react"
import { getActiveBanners, type Banner } from "@/lib/api/banners"
import { cn } from "@/lib/utils"

export function HomeBanner() {
  const router = useRouter()
  const [banners, setBanners] = useState<Banner[]>([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    getActiveBanners()
      .then(setBanners)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const prev = useCallback(() => {
    setCurrent((i) => (i === 0 ? banners.length - 1 : i - 1))
  }, [banners.length])

  const next = useCallback(() => {
    setCurrent((i) => (i === banners.length - 1 ? 0 : i + 1))
  }, [banners.length])

  // Auto-advance
  useEffect(() => {
    if (banners.length <= 1) return
    const timer = setInterval(next, 6000)
    return () => clearInterval(timer)
  }, [banners.length, next])

  useEffect(() => {
    setImageFailed(false)
  }, [current])

  if (loading) {
    return (
      <div className="relative w-full overflow-hidden rounded-lg bg-muted animate-pulse" style={{ aspectRatio: "21/7" }} />
    )
  }

  if (!banners.length) return null

  const banner = banners[current]

  const inner = (
    <div
      className="relative w-full overflow-hidden rounded-lg"
      style={{ aspectRatio: "21/7" }}
      onClick={() => {
        if (banner.link_url) {
          router.push(banner.link_url)
        }
      }}
    >
      {banner.image_url && !imageFailed ? (
        <img
          src={banner.image_url}
          alt={banner.title ?? "Banner"}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
          loading="eager"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-muted" />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />

      {/* Text content disabled: banner artwork already contains typography.
      {(banner.title || banner.subtitle) && (
        <div className="absolute inset-0 flex flex-col justify-end p-8 pb-10">
          {banner.title && (
            <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md md:text-4xl lg:text-5xl">
              {banner.title}
            </h1>
          )}
          {banner.subtitle && (
            <p className="mt-2 max-w-lg text-base text-white/80 drop-shadow-sm md:text-lg">
              {banner.subtitle}
            </p>
          )}
        </div>
      )}
      */}

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          router.push("/explore")
        }}
        className="absolute cursor-pointer bottom-4 left-4 z-10 inline-flex items-center gap-2 rounded-md bg-black/65 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-black/80"
        aria-label="Go to trending"
      >
        <ListMusic className="h-4 w-4" />
        Trending
      </button>

      {/* Navigation arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); prev() }}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/60"
            aria-label="Previous banner"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); next() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/60"
            aria-label="Next banner"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.preventDefault(); setCurrent(i) }}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === current ? "w-5 bg-white" : "w-1.5 bg-white/40"
              )}
              aria-label={`Go to banner ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )

  return inner
}
