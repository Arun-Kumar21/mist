import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { tracksApi } from "../lib/api";
import { useAuthStore } from "../store/authStore";
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

function TrackCard({ track, onPlay }: { track: Track; onPlay: (id: number) => void }) {
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <button
            onClick={() => onPlay(track.track_id)}
            className="border border-gray-300 p-3 hover:bg-gray-50 transition-colors block text-left w-full"
        >
            <div className="font-medium text-sm mb-1">{track.title}</div>
            <div className="text-xs text-gray-600 mb-1">{track.artist_name}</div>
            <div className="text-xs text-gray-500 flex gap-3">
                {track.genre_top && <span>{track.genre_top}</span>}
                <span>{formatDuration(track.duration_sec)}</span>
                {track.listens > 0 && <span>{track.listens} plays</span>}
            </div>
        </button>
    );
}

export default function Library() {
    const { isAuthenticated } = useAuthStore();
    const navigate = useNavigate();
    const [tracks, setTracks] = useState<Track[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [authError, setAuthError] = useState(false);
    const LIMIT = 20;

    const handlePlay = (trackId: number) => {
        if (!isAuthenticated) {
            setAuthError(true);
            return;
        }
        navigate(`/player/${trackId}`);
    };

    useEffect(() => {
        loadTracks();
    }, [page]);

    const loadTracks = async () => {
        try {
            setLoading(true);
            setAuthError(false);
            const skip = (page - 1) * LIMIT;
            const res = await tracksApi.getTracks({ skip, limit: LIMIT });
            
            setTracks(res.data.tracks);
            setHasMore(res.data.tracks.length === LIMIT);
        } catch (error) {
            console.error('Failed to load tracks:', error);
            setTracks([]);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    };

    const handlePrevPage = () => {
        if (page > 1) {
            setPage(page - 1);
            window.scrollTo(0, 0);
        }
    };

    const handleNextPage = () => {
        if (hasMore) {
            setPage(page + 1);
            window.scrollTo(0, 0);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-4">
            <h1 className="font-medium text-lg mb-4">Music Library</h1>

            {authError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 text-sm">
                    Please log in to listen to tracks.{' '}
                    <button
                        onClick={() => navigate('/login')}
                        className="underline font-medium"
                    >
                        Log in
                    </button>
                </div>
            )}

            {loading && (
                <div className="flex flex-col gap-2">
                    {[...Array(20)].map((_, i) => <TrackSkeleton key={i} />)}
                </div>
            )}

            {!loading && tracks.length > 0 && (
                <>
                    <div className="text-xs text-gray-600 mb-3">
                        Showing {(page - 1) * LIMIT + 1}-{(page - 1) * LIMIT + tracks.length}
                    </div>
                    <div className="flex flex-col gap-2 mb-4">
                        {tracks.map((track) => (
                            <TrackCard key={track.track_id} track={track} onPlay={handlePlay} />
                        ))}
                    </div>

                    <div className="flex justify-between items-center gap-2">
                        <button
                            onClick={handlePrevPage}
                            disabled={page === 1}
                            className="px-4 py-2 text-sm bg-gray-200 text-gray-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-600">Page {page}</span>
                        <button
                            onClick={handleNextPage}
                            disabled={!hasMore}
                            className="px-4 py-2 text-sm bg-gray-200 text-gray-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </>
            )}

            {!loading && tracks.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-8">
                    No tracks available
                </div>
            )}
        </div>
    );
}
