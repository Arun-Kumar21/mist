"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, ListMusic } from "lucide-react"
import { getActiveBanners, type Banner } from "@/lib/api/banners"
import { cn } from "@/lib/utils"

export function HomeBanner() {
  const router = useRouter()
  const [banners, setBanners] = useState<Banner[]>([])
  // trackIndex: 0 = clone-of-last, 1..N = real slides, N+1 = clone-of-first
  const [trackIndex, setTrackIndex] = useState(1)
  const [animated, setAnimated] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  useEffect(() => {
    getActiveBanners()
      .then(setBanners)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const n = banners.length

  // After the CSS transition ends, silently jump to the real counterpart slide
  const handleTransitionEnd = useCallback(() => {
    if (trackIndex === n + 1) {
      setAnimated(false)
      setTrackIndex(1)
    } else if (trackIndex === 0) {
      setAnimated(false)
      setTrackIndex(n)
    }
    setIsTransitioning(false)
  }, [trackIndex, n])

  // Re-enable transition on the next two frames after a silent jump
  useEffect(() => {
    if (!animated) {
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setAnimated(true))
      )
      return () => cancelAnimationFrame(id)
    }
  }, [animated])

  const next = useCallback(() => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setAnimated(true)
    setTrackIndex((i) => i + 1)
  }, [isTransitioning])

  const prev = useCallback(() => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setAnimated(true)
    setTrackIndex((i) => i - 1)
  }, [isTransitioning])

  const goTo = useCallback((logicalIndex: number) => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setAnimated(true)
    setTrackIndex(logicalIndex + 1)
  }, [isTransitioning])

  // Auto-advance
  useEffect(() => {
    if (n <= 1) return
    const timer = setInterval(next, 6000)
    return () => clearInterval(timer)
  }, [n, next])

  if (loading) {
    return (
      <div className="relative w-full overflow-hidden rounded-lg bg-muted animate-pulse" style={{ aspectRatio: "21/7" }} />
    )
  }

  if (!banners.length) return null

  // Track layout: [clone-last, real-0, real-1, …, real-N-1, clone-first]
  const slides: Banner[] = [banners[n - 1], ...banners, banners[0]]
  const slideCount = slides.length

  // Map trackIndex back to a 0-based logical index for the dots
  const dotActive = Math.max(0, Math.min(n - 1, trackIndex - 1))

  return (
    <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "21/7" }}>

      {/* Sliding track */}
      <div
        className={cn("flex h-full", animated && "transition-transform duration-700 ease-in-out")}
        style={{
          width: `${slideCount * 100}%`,
          transform: `translateX(-${(trackIndex / slideCount) * 100}%)`,
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {slides.map((b, i) => (
          <div
            key={i}
            className="relative h-full shrink-0"
            style={{ width: `${100 / slideCount}%` }}
            onClick={() => { if (b.link_url) router.push(b.link_url) }}
          >
            {b.image_url && !failedImages.has(b.image_url) ? (
              <img
                src={b.image_url}
                alt={b.title ?? "Banner"}
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
                loading={i === 1 ? "eager" : "lazy"}
                onError={() =>
                  setFailedImages((prev) => {
                    const next = new Set(prev)
                    next.add(b.image_url!)
                    return next
                  })
                }
              />
            ) : (
              <div className="absolute inset-0 bg-muted" />
            )}
          </div>
        ))}
      </div>

      {/* Gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-black/55 via-black/15 to-transparent" />

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

      {/* Trending CTA — bottom left */}
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push("/trending") }}
        className="absolute bottom-3 left-3 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-black/65 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-black/80 sm:bottom-4 sm:left-4 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
        aria-label="Go to trending"
      >
        <ListMusic className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Trending
      </button>

      {/* Navigation arrows */}
      {n > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev() }}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/60 sm:left-3"
            aria-label="Previous banner"
          >
            <ChevronLeft className="h-5 w-5 cursor-pointer"/>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next() }}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/60 sm:right-3"
            aria-label="Next banner"
          >
            <ChevronRight className="h-5 w-5 cursor-pointer " />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {n > 1 && (
        <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 sm:bottom-4">
          {banners.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); goTo(i) }}
              className={cn(
                "h-1.5 rounded-full bg-white transition-all duration-500 ease-in-out",
                i === dotActive ? "w-6 opacity-100" : "w-1.5 opacity-40"
              )}
              aria-label={`Go to banner ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
