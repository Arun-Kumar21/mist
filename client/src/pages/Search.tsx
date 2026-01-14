import { useState } from "react"
import { Link } from "react-router";
import { tracksApi } from "../lib/api";
import type { Track } from "../types";

function TrackSkeleton() {
    return (
        <div className="border border-gray-300 p-3 animate-pulse">
            <div className="h-4 bg-gray-200 mb-2 w-3/4"></div>
            <div className="h-3 bg-gray-200 mb-1 w-1/2"></div>
            <div className="h-3 bg-gray-200 w-1/3"></div>
        </div>
    );
}

function TrackCard({ track }: { track: Track }) {
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <Link to={`/player/${track.track_id}`} className="border border-gray-300 p-3 hover:bg-gray-50 transition-colors block">
            <div className="font-medium text-sm mb-1">{track.title}</div>
            <div className="text-xs text-gray-600 mb-1">{track.artist_name}</div>
            <div className="text-xs text-gray-500 flex gap-3">
                {track.genre_top && <span>{track.genre_top}</span>}
                <span>{formatDuration(track.duration_sec)}</span>
                {track.listens > 0 && <span>{track.listens} plays</span>}
            </div>
        </Link>
    );
}

export default function SearchPage () {
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [tracks, setTracks] = useState<Track[]>();

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const res = await tracksApi.searchTrack(search)
            setTracks(res.data.tracks);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && search.trim()) {
            handleSubmit();
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-4">
            <h1 className="font-medium text-lg mb-4">Find your favourite songs</h1>

            <div className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Search by title or artist..."
                    required
                    className="flex-1 border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                />
                <button 
                    onClick={handleSubmit} 
                    disabled={loading || search.trim() === ""} 
                    className="px-4 py-2 text-sm bg-blue-600 text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                    Search
                </button>
            </div>

            {loading && (
                <div className="flex flex-col gap-2">
                    {[...Array(6)].map((_, i) => <TrackSkeleton key={i} />)}
                </div>
            )}

            {!loading && tracks && tracks.length > 0 && (
                <div>
                    <div className="text-xs text-gray-600 mb-3">{tracks.length} result{tracks.length !== 1 ? 's' : ''} found</div>
                    <div className="flex flex-col gap-2">
                        {tracks.map((track) => (
                            <TrackCard key={track.track_id} track={track} />
                        ))}
                    </div>
                </div>
            )}

            {!loading && tracks && tracks.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-8">
                    No tracks found for "{search}"
                </div>
            )}
        </div>
    )
}