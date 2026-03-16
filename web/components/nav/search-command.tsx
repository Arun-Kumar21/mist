"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Compass, Library, LoaderCircle, Music2, PlusSquare, SearchIcon, UserCog, Waves } from "lucide-react"

import { searchTracks, type TrackSearchResult } from "@/lib/api/tracks"
import { usePlayerStore } from "@/lib/stores/player-store"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

const pageLinks = [
  { label: "Home", href: "/", icon: Waves, keywords: "music home landing" },
  { label: "Explore", href: "/explore", icon: Compass, keywords: "discover browse" },
  { label: "Feed", href: "/feed", icon: Music2, keywords: "activity updates" },
  { label: "Collections", href: "/collections", icon: Library, keywords: "likes playlists library" },
  { label: "Account", href: "/account", icon: UserCog, keywords: "profile settings manage" },
  { label: "Create Playlist", href: "/playlists/create", icon: PlusSquare, keywords: "playlist create new" },
]

function formatListens(listens: number | null) {
  if (!listens) return null
  if (listens >= 1000000) return `${(listens / 1000000).toFixed(1)}M listens`
  if (listens >= 1000) return `${(listens / 1000).toFixed(1)}K listens`
  return `${listens} listens`
}

export function SearchCommand() {
  const router = useRouter()
  const setQueueAndPlay = usePlayerStore((state) => state.setQueueAndPlay)
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<TrackSearchResult[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  React.useEffect(() => {
    if (!open) {
      setQuery("")
      setResults([])
    }
  }, [open])

  React.useEffect(() => {
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      setLoading(false)
      setResults([])
      return
    }

    let cancelled = false
    setLoading(true)

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await searchTracks(trimmedQuery)

        if (cancelled) return

        React.startTransition(() => {
          setResults(response.tracks)
        })
      } catch {
        if (!cancelled) {
          React.startTransition(() => {
            setResults([])
          })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }, 80)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [query])

  const queue = React.useMemo(
    () =>
      results.map((track) => ({
        track_id: track.track_id,
        title: track.title,
        artist_name: track.artist_name,
        cover_image_url: track.cover_image_url,
      })),
    [results]
  )

  const openPage = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  const hasQuery = Boolean(query.trim())

  const playTrack = (trackId: number) => {
    const index = queue.findIndex((track) => track.track_id === trackId)
    if (index === -1) return

    setOpen(false)
    setQueueAndPlay(queue, index)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-2 border-border/70 bg-background/70 px-2.5 text-muted-foreground shadow-none hover:bg-accent/60 hover:text-foreground sm:px-3"
        onClick={() => setOpen(true)}
        aria-label="Open search"
      >
        <SearchIcon className="size-4" />
        <span className="hidden text-sm sm:inline">Search</span>
        <CommandShortcut className="hidden rounded border border-border/70 px-1.5 py-0.5 text-[10px] tracking-[0.2em] lg:inline-flex">
          Ctrl K
        </CommandShortcut>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Search songs or jump to pages."
        className="max-w-2xl border-border/70 bg-background/98"
      >
        <Command shouldFilter>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search song, author, genre..."
          />
          <CommandList className="max-h-112">
            {hasQuery ? (
              <CommandGroup heading="Songs">
                {loading ? (
                  <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    Searching songs...
                  </div>
                ) : results.length ? (
                  results.map((track) => (
                    <CommandItem
                      key={track.track_id}
                      value={`${track.title ?? ""} ${track.artist_name ?? ""} ${track.genre_top ?? ""}`}
                      onSelect={() => playTrack(track.track_id)}
                      className="items-start gap-3 py-2.5"
                    >
                      {track.cover_image_url ? (
                        <img
                          src={track.cover_image_url}
                          alt={track.title ?? "Track cover"}
                          className="mt-0.5 h-11 w-11 rounded-md object-cover"
                        />
                      ) : (
                        <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Music2 className="size-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {track.title ?? "Untitled Track"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {track.artist_name ?? "Unknown Artist"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          {track.genre_top ? (
                            <span className="rounded-full border border-border/70 px-1.5 py-0.5 uppercase tracking-[0.14em]">
                              {track.genre_top}
                            </span>
                          ) : null}
                          {formatListens(track.listens) ? <span>{formatListens(track.listens)}</span> : null}
                        </div>
                      </div>
                    </CommandItem>
                  ))
                ) : (
                  <div className="px-2 py-3 text-sm text-muted-foreground">
                    No songs found for this search.
                  </div>
                )}
              </CommandGroup>
            ) : null}

            {hasQuery ? <CommandSeparator /> : null}

            <CommandGroup heading="Pages">
              {pageLinks.map((page) => (
                <CommandItem
                  key={page.href}
                  value={`${page.label} ${page.keywords}`}
                  onSelect={() => openPage(page.href)}
                >
                  <page.icon />
                  <span>{page.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}