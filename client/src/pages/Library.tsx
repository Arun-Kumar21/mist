import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { tracksApi } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import type { Track } from '../types'
import { Button } from '@/components/ui/button'
import { getGradient } from '@/lib/gradient'

function TrackSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-neutral-100 animate-pulse">
      <div className="aspect-square bg-neutral-100" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-neutral-100 rounded-full w-3/4" />
        <div className="h-2.5 bg-neutral-100 rounded-full w-1/2" />
      </div>
    </div>
  )
}

function TrackCard({ track, onPlay }: { track: Track; onPlay: (id: number) => void }) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <button
      onClick={() => onPlay(track.track_id)}
      className="rounded-2xl overflow-hidden border border-neutral-200 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left w-full group bg-white"
    >
      <div
        className="aspect-square w-full"
        style={{ background: getGradient(track.track_id) }}
      />
      <div className="p-3">
        <p className="text-sm font-medium truncate group-hover:text-black">{track.title}</p>
        <p className="text-xs text-neutral-500 truncate mt-0.5">{track.artist_name}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {track.genre_top && (
            <span className="text-[10px] text-neutral-400 bg-neutral-50 border border-neutral-100 rounded-full px-2 py-0.5 truncate max-w-[80px]">
              {track.genre_top}
            </span>
          )}
          <span className="text-[10px] text-neutral-400 ml-auto shrink-0">{formatDuration(track.duration_sec)}</span>
        </div>
      </div>
    </button>
  )
}

export default function Library() {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [authError, setAuthError] = useState(false)
  const LIMIT = 20

  const handlePlay = (trackId: number) => {
    if (!isAuthenticated) {
      setAuthError(true)
      return
    }
    navigate(`/player/${trackId}`)
  }

  useEffect(() => {
    loadTracks()
  }, [page])

  const loadTracks = async () => {
    try {
      setLoading(true)
      setAuthError(false)
      const skip = (page - 1) * LIMIT
      const res = await tracksApi.getTracks({ skip, limit: LIMIT })
      setTracks(res.data.tracks)
      setHasMore(res.data.tracks.length === LIMIT)
    } catch (error) {
      console.error('Failed to load tracks:', error)
      setTracks([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight mb-1">Library</h1>
        <p className="text-sm text-neutral-500">Browse the full track catalogue</p>
      </div>

      {authError && (
        <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm flex items-center justify-between">
          <span>Sign in to listen to tracks.</span>
          <button
            onClick={() => navigate('/login')}
            className="font-medium underline underline-offset-2"
          >
            Sign in
          </button>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(LIMIT)].map((_, i) => <TrackSkeleton key={i} />)}
        </div>
      )}

      {!loading && tracks.length > 0 && (
        <>
          <p className="text-xs text-neutral-400 uppercase tracking-wide">
            {(page - 1) * LIMIT + 1}–{(page - 1) * LIMIT + tracks.length}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {tracks.map((track) => (
              <TrackCard key={track.track_id} track={track} onPlay={handlePlay} />
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setPage(page - 1); window.scrollTo(0, 0) }}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-neutral-500">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setPage(page + 1); window.scrollTo(0, 0) }}
              disabled={!hasMore}
            >
              Next
            </Button>
          </div>
        </>
      )}

      {!loading && tracks.length === 0 && (
        <p className="text-sm text-neutral-500 py-12 text-center">No tracks available</p>
      )}
    </div>
  )
}