"use client"

import { useEffect, useState } from "react"
import type { RefObject } from "react"
import { getAuthToken } from "@/lib/api/auth"

function shouldAttachAuth(url: string): boolean {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1"
    const apiOrigin = new URL(apiBase).origin
    const resolved = new URL(url, window.location.origin)
    return resolved.origin === apiOrigin || resolved.origin === window.location.origin
  } catch {
    return false
  }
}

export function useHLSPlayer(streamUrl: string | null, audioRef: RefObject<HTMLAudioElement | null>) {
  const [hlsLoaded, setHlsLoaded] = useState(false)
  const [hlsError, setHlsError] = useState(false)

  useEffect(() => {
    if (!streamUrl || !audioRef.current) {
      setHlsLoaded(false)
      setHlsError(false)
      return
    }

    let cleanup: (() => void) | undefined
    let mounted = true

    const init = async () => {
      const audio = audioRef.current
      if (!audio) return
      setHlsError(false)

      try {
        const { default: Hls } = await import("hls.js")

        if (!mounted) return

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            xhrSetup: (xhr, url) => {
              const token = getAuthToken()
              if (token && url && shouldAttachAuth(url)) {
                xhr.setRequestHeader("Authorization", `Bearer ${token}`)
              }
            },
            fetchSetup: (context, initParams) => {
              const token = getAuthToken()
              const attachAuth = token && shouldAttachAuth(context.url)
              return new Request(context.url, {
                ...initParams,
                headers: {
                  ...(initParams?.headers || {}),
                  ...(attachAuth ? { Authorization: `Bearer ${token}` } : {}),
                },
              })
            },
          })

          hls.loadSource(streamUrl)
          hls.attachMedia(audio)

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (mounted) {
              setHlsLoaded(true)
              setHlsError(false)
            }
          })

          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal && mounted) {
              setHlsLoaded(false)
              setHlsError(true)
            }
          })

          cleanup = () => {
            hls.destroy()
          }
        } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
          audio.src = streamUrl
          const onLoaded = () => {
            if (mounted) setHlsLoaded(true)
          }
          audio.addEventListener("loadedmetadata", onLoaded)

          cleanup = () => {
            audio.removeEventListener("loadedmetadata", onLoaded)
            audio.removeAttribute("src")
            audio.load()
          }
        } else {
          setHlsLoaded(false)
          setHlsError(true)
        }
      } catch {
        setHlsLoaded(false)
        setHlsError(true)
      }
    }

    init()

    return () => {
      mounted = false
      setHlsLoaded(false)
      setHlsError(false)
      cleanup?.()
    }
  }, [streamUrl, audioRef])

  return { hlsLoaded, hlsError }
}
