"use client"

import * as React from "react"
import Link from "next/link"

import { TrackGridSection } from "@/components/music/track-grid-section"
import { Button } from "@/components/ui/button"
import { getPersonalizedFeed, type PersonalizedFeed } from "@/lib/api/library"
import { useAuthStore } from "@/lib/stores/auth-store"

const initialFeed: PersonalizedFeed = {
  liked_seed_tracks: [],
  listened_seed_tracks: [],
  recommendations: [],
  count: 0,
}

export default function FeedPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [feed, setFeed] = React.useState<PersonalizedFeed>(initialFeed)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!isAuthenticated) {
      setFeed(initialFeed)
      setLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getPersonalizedFeed(24)
        if (!cancelled) setFeed(data)
      } catch {
        if (!cancelled) setError("Failed to build your feed.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return (
      <section className="space-y-4 p-3 sm:p-4 lg:p-6">
        <div className="rounded-2xl border border-border bg-card/60 p-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Feed</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Your Personal Mix</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Sign in to get a feed built from what you like and what you actually listen to most.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/login">Login to unlock feed</Link>
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-8 p-3 sm:p-4 lg:p-6">
      <div className="rounded-2xl border border-border bg-card/60 p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Feed</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Your Personal Mix</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          These recommendations blend track-embedding similarity with the songs you liked and your listening history.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 max-[359px]:grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={`feed-loading-${index}`} className="space-y-2">
              <div className="aspect-16/10 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <TrackGridSection
            title="Recommended For You"
            description="Picked from cosine-similar tracks around the music you already prefer."
            tracks={feed.recommendations}
            emptyText="Start liking and listening to songs to build your feed."
          />

          <TrackGridSection
            title="Because You Liked"
            description="Your saved tracks currently shaping the feed."
            tracks={feed.liked_seed_tracks}
            emptyText="Like a few songs to seed this section."
          />

          <TrackGridSection
            title="From Your Listening Patterns"
            description="Weighted by how often and how long you listen."
            tracks={feed.listened_seed_tracks}
            emptyText="Play more songs and this section will get smarter."
          />
        </>
      )}
    </section>
  )
}
