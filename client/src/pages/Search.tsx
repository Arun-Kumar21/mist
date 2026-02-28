import { useState } from 'react'
import { Link } from 'react-router'
import { tracksApi } from '../lib/api'
import type { Track } from '../types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search as SearchIcon } from 'lucide-react'
import { getGradient } from '@/lib/gradient'

function TrackSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2.5 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-neutral-100 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-neutral-100 rounded-full w-2/3" />
        <div className="h-2.5 bg-neutral-100 rounded-full w-1/3" />
      </div>
    </div>
  )
}

function TrackRow({ track }: { track: Track }) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Link
      to={`/player/${track.track_id}`}
      className="flex items-center gap-3 py-2.5 rounded-xl hover:bg-neutral-50 px-2 -mx-2 transition-colors group"
    >
      <div
        className="w-10 h-10 rounded-xl shrink-0"
        style={{ background: getGradient(track.track_id) }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate group-hover:text-black">{track.title}</p>
        <p className="text-xs text-neutral-500 truncate">{track.artist_name}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-xs text-neutral-400">
        {track.genre_top && <span>{track.genre_top}</span>}
        <span>{formatDuration(track.duration_sec)}</span>
      </div>
    </Link>
  )
}

export default function SearchPage() {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [tracks, setTracks] = useState<Track[] | undefined>(undefined)

  const handleSubmit = async () => {
    if (!search.trim()) return
    try {
      setLoading(true)
      const res = await tracksApi.searchTrack(search)
      setTracks(res.data.tracks)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight mb-1">Search</h1>
        <p className="text-sm text-neutral-500">Find tracks by title or artist</p>
      </div>

      <div className="flex gap-2">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Title or artist..."
          className="flex-1"
          autoFocus
        />
        <Button
          onClick={handleSubmit}
          disabled={loading || search.trim() === ''}
          size="sm"
          className="px-4"
        >
          <SearchIcon className="w-4 h-4" />
        </Button>
      </div>

      {loading && (
        <div>
          {[...Array(8)].map((_, i) => <TrackSkeleton key={i} />)}
        </div>
      )}

      {!loading && tracks && tracks.length > 0 && (
        <div>
          <p className="text-xs text-neutral-400 mb-2 uppercase tracking-wide">
            {tracks.length} result{tracks.length !== 1 ? 's' : ''}
          </p>
          {tracks.map((track) => (
            <TrackRow key={track.track_id} track={track} />
          ))}
        </div>
      )}

      {!loading && tracks && tracks.length === 0 && (
        <p className="text-sm text-neutral-500 py-8 text-center">
          No tracks found for &ldquo;{search}&rdquo;
        </p>
      )}
    </div>
  )
}