"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { isAxiosError } from "axios"
import {
  ChevronUp,
  Heart,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Repeat,
  Volume2,
  VolumeX,
} from "lucide-react"

import {
  completeListeningSession,
  getTrackLikeStatus,
  getTrackStreamInfo,
  likeTrack,
  sendListeningHeartbeat,
  startListeningSession,
  unlikeTrack,
} from "@/lib/api/player"
import { useHLSPlayer } from "@/hooks/use-hls-player"
import { usePlayerStore } from "@/lib/stores/player-store"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useTrackLikesStore } from "@/lib/stores/track-likes-store"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function getPlaybackErrorMessage(error: unknown) {
  if (!isAxiosError(error)) {
    return "This song can't be played right now."
  }

  if (error.response?.status === 429) {
    return "Daily quota finished for today."
  }

  const detail = error.response?.data?.detail
  if (typeof detail === "string" && detail.trim()) {
    return detail
  }
  if (detail && typeof detail === "object" && "error" in detail) {
    const detailError = (detail as { error?: unknown }).error
    if (typeof detailError === "string" && detailError.trim()) {
      return detailError
    }
  }

  return "This song can't be played right now."
}

export function PlayerBottomBar() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const sessionIdRef = useRef<number | null>(null)
  const currentTimeRef = useRef(0)

  const { queue, currentIndex, isVisible, playVersion, nextTrack, previousTrack } = usePlayerStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const likedMap = useTrackLikesStore((s) => s.likes)
  const setLikeStatus = useTrackLikesStore((s) => s.setLikeStatus)

  const currentTrack = queue[currentIndex] ?? null

  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoop, setIsLoop] = useState(false)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.75)
  const [isMuted, setIsMuted] = useState(false)
  const [loadingTrack, setLoadingTrack] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)

  const liked = currentTrack ? Boolean(likedMap[currentTrack.track_id]) : false

  const { hlsLoaded, hlsError } = useHLSPlayer(streamUrl, audioRef)

  // Load stream + start listen session whenever selected track changes.
  useEffect(() => {
    if (!currentTrack || !isAuthenticated) {
      return
    }

    setLikeStatus(currentTrack.track_id, false)

    let cancelled = false

    const load = async () => {
      setLoadingTrack(true)
      setPlayerError(null)

      try {
        await transitionFromCurrentTrack()

        const [stream, session, likeState] = await Promise.all([
          getTrackStreamInfo(currentTrack.track_id),
          startListeningSession(currentTrack.track_id),
          getTrackLikeStatus(currentTrack.track_id).catch(() => ({ liked: false })),
        ])

        if (cancelled) return

        setStreamUrl(stream.streamUrl)
        setSessionId(session.session_id ?? null)
        setLikeStatus(currentTrack.track_id, Boolean((likeState as { liked?: boolean }).liked))
      } catch (error) {
        if (cancelled) return
        setStreamUrl(null)
        setSessionId(null)
        setPlayerError(getPlaybackErrorMessage(error))
      } finally {
        if (!cancelled) setLoadingTrack(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [currentTrack?.track_id, isAuthenticated, setLikeStatus])

  // Autoplay whenever a user explicitly starts/changes tracks.
  useEffect(() => {
    if (!audioRef.current || !hlsLoaded || loadingTrack) return

    const playAttempt = async () => {
      try {
        await audioRef.current?.play()
      } catch {
        // User gesture policies may block autoplay; play button still works.
      }
    }

    playAttempt()
  }, [playVersion, hlsLoaded, loadingTrack])

  // Complete previous session on unmount.
  useEffect(() => {
    return () => {
      if (sessionId !== null && audioRef.current) {
        void completeListeningSession(sessionId, audioRef.current.currentTime).catch(() => {})
      }
    }
  }, [sessionId])

  // Heartbeat while playing.
  useEffect(() => {
    if (!isPlaying || sessionId === null || !audioRef.current) return

    const timer = setInterval(() => {
      if (!audioRef.current) return
      void sendListeningHeartbeat(sessionId, audioRef.current.currentTime).catch(() => {})
    }, 5000)

    return () => clearInterval(timer)
  }, [isPlaying, sessionId])

  // Volume controls.
  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = volume
    audioRef.current.muted = isMuted
  }, [volume, isMuted])

  const progress = useMemo(() => {
    if (!duration) return 0
    return Math.min(100, (currentTime / duration) * 100)
  }, [currentTime, duration])

  const transitionFromCurrentTrack = async () => {
    const previousSessionId = sessionIdRef.current
    const previousPosition = audioRef.current?.currentTime ?? currentTimeRef.current

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }

    setIsPlaying(false)
    setStreamUrl(null)
    setSessionId(null)
    setCurrentTime(0)
    setDuration(0)

    if (previousSessionId !== null) {
      await completeListeningSession(previousSessionId, previousPosition).catch(() => {})
    }
  }

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    currentTimeRef.current = currentTime
  }, [currentTime])

  const togglePlay = async () => {
    if (!audioRef.current || !hlsLoaded || hlsError || !!playerError) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      try {
        if (sessionId === null && currentTrack) {
          const session = await startListeningSession(currentTrack.track_id)
          setSessionId(session.session_id ?? null)
        }

        if (duration > 0 && currentTime >= duration - 0.25) {
          audioRef.current.currentTime = 0
          setCurrentTime(0)
        }
        await audioRef.current.play()
      } catch (error) {
        setPlayerError(getPlaybackErrorMessage(error))
      }
    }
  }

  const onSeek = (value: number) => {
    if (!audioRef.current || !duration) return
    const target = (value / 100) * duration
    audioRef.current.currentTime = target
    setCurrentTime(target)
  }

  const toggleLike = async () => {
    if (!currentTrack || !isAuthenticated) return
    try {
      if (liked) {
        setLikeStatus(currentTrack.track_id, false)
        await unlikeTrack(currentTrack.track_id)
      } else {
        setLikeStatus(currentTrack.track_id, true)
        await likeTrack(currentTrack.track_id)
      }
    } catch {
      setLikeStatus(currentTrack.track_id, liked)
    }
  }

  const handleEnded = () => {
    if (isLoop && audioRef.current) {
      audioRef.current.currentTime = 0
      void audioRef.current.play().catch(() => {})
      return
    }

    const finishedSessionId = sessionId
    const finishedAt = audioRef.current?.currentTime ?? duration

    setIsPlaying(false)
    setSessionId(null)

    if (finishedSessionId !== null) {
      void completeListeningSession(finishedSessionId, finishedAt).catch(() => {})
    }
  }

  const handleNextTrack = () => {
    nextTrack()
  }

  const handlePreviousTrack = () => {
    previousTrack()
  }

  useEffect(() => {
    if (hlsError) {
      setPlayerError("This song can't be played right now.")
    }
  }, [hlsError])

  if (!isVisible || !currentTrack) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-zinc-100 backdrop-blur dark:bg-zinc-900 supports-backdrop-filter:bg-zinc-100/90 dark:supports-backdrop-filter:bg-zinc-900/90">
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={handleEnded}
        className="hidden"
      />

      <div className="mx-auto w-full max-w-7xl px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted">
            {currentTrack.cover_image_url ? (
              <img
                src={currentTrack.cover_image_url}
                alt={currentTrack.title ?? "Track"}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{currentTrack.title ?? "Untitled Track"}</p>
            <p className="truncate text-xs text-muted-foreground">{currentTrack.artist_name ?? "Unknown Artist"}</p>
          </div>

          <button
            type="button"
            onClick={toggleLike}
            className={cn(
              "ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full border transition",
              liked
                ? "border-rose-500/40 bg-rose-500/10 text-rose-500"
                : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
            )}
            aria-label="Like current track"
          >
            <Heart className={cn("h-4 w-4", liked && "fill-current")} />
          </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsMuted((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 hover:bg-muted"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[isMuted ? 0 : volume]}
              onValueChange={(values) => {
                const nextVolume = values[0] ?? 0
                setVolume(nextVolume)
                if (nextVolume > 0 && isMuted) {
                  setIsMuted(false)
                }
              }}
              className="hidden w-24 md:flex"
              aria-label="Volume"
            />

            <button
              type="button"
              className="h-9 w-9 items-center justify-center rounded-full border border-border/70 hover:bg-muted hidden"
              aria-label="Expand player details"
              title="Full player view coming soon"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isAuthenticated ? (
          <div className="mt-2 space-y-2 sm:mt-3">
            <div className="flex items-center justify-center gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={() => {
                  handlePreviousTrack()
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 hover:bg-muted"
                aria-label="Previous track"
              >
                <SkipBack className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                disabled={!hlsLoaded || loadingTrack || !!playerError}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-full text-primary-foreground",
                  !hlsLoaded || loadingTrack || !!playerError
                    ? "cursor-not-allowed bg-muted text-muted-foreground"
                    : "bg-primary hover:opacity-90"
                )}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" fill="currentColor" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  handleNextTrack()
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 hover:bg-muted"
                aria-label="Next track"
              >
                <SkipForward className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsLoop((v) => !v)}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 sm:inline-flex",
                  isLoop ? "bg-primary/15 text-primary" : "hover:bg-muted"
                )}
                aria-label="Toggle loop"
              >
                <Repeat className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-[42px_1fr_42px] items-center gap-2 sm:gap-3">
              <span className="text-[11px] text-muted-foreground tabular-nums">{formatTime(currentTime)}</span>
              <Slider
                min={0}
                max={100}
                step={0.1}
                value={[progress]}
                onValueChange={(values) => onSeek(values[0] ?? 0)}
                className="w-full"
                aria-label="Seek track"
              />
              <span className="text-right text-[11px] text-muted-foreground tabular-nums">
                {formatTime(duration)}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-center sm:mt-3">
            <Link
              href="/login"
              className="rounded-full border border-border/70 bg-muted/50 px-3 py-1.5 text-xs font-medium tracking-wide text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Login to listen
            </Link>
          </div>
        )}
      </div>

      {loadingTrack ? (
        <div className="px-4 pb-2 text-center text-[11px] text-muted-foreground">Loading stream...</div>
      ) : playerError ? (
        <div className="px-4 pb-2 text-center text-[11px] text-amber-500">{playerError}</div>
      ) : null}
    </div>
  )
}
