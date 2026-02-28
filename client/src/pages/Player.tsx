import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { tracksApi, listenApi } from '../lib/api';
import { useHLSPlayer } from '../hooks/useHLSPlayer';
import TrackInfo from '../components/player/TrackInfo';
import PlayerControls from '../components/player/PlayerControls';
import BufferVisualization from '../components/player/BufferVisualization';
import type { Track } from '../types';

interface StreamInfo {
    success: boolean;
    trackId: number;
    streamUrl: string;
    keyEndpoint: string;
    duration: number;
    encrypted: boolean;
}

export default function Player() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const audioRef = useRef<HTMLAudioElement>(null);
    
    const [track, setTrack] = useState<Track | null>(null);
    const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [bufferedRanges, setBufferedRanges] = useState<{ start: number; end: number }[]>([]);
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [quota, setQuota] = useState<any>(null);

    const { hlsLoaded } = useHLSPlayer(streamInfo, audioRef, loading, error);

    useEffect(() => {
        if (!id) return;

        const loadTrack = async () => {
            try {
                const trackResponse = await tracksApi.getTrack(parseInt(id));
                setTrack(trackResponse.data);

                const streamResponse = await tracksApi.getStreamInfo(parseInt(id));
                setStreamInfo(streamResponse.data);

                const sessionResponse = await listenApi.startSession(parseInt(id));
                setSessionId(sessionResponse.data.session_id);
                setQuota(sessionResponse.data.quota);
            } catch (err: any) {
                if (err.response?.status === 429) {
                    const detail = err.response?.data?.detail;
                    if (typeof detail === 'object' && detail.error) {
                        setError(`${detail.error}. Used ${Math.floor(detail.minutes_used)} of ${Math.floor(detail.quota_limit)} minutes today.`);
                    } else {
                        setError('Daily listening quota exceeded');
                    }
                } else {
                    setError(err.response?.data?.detail || 'Failed to load track');
                }
            } finally {
                setLoading(false);
            }
        };

        loadTrack();
    }, [id]);

    useEffect(() => {
        if (!isPlaying || sessionId === null || !audioRef.current) return;
        const heartbeatInterval = setInterval(async () => {
            if (audioRef.current && sessionId !== null) {
                try {
                    const response = await listenApi.heartbeat(sessionId, audioRef.current.currentTime);
                    setQuota(response.data.quota);
                } catch {}
            }
        }, 5000);
        return () => clearInterval(heartbeatInterval);
    }, [isPlaying, sessionId]);

    useEffect(() => {
        return () => {
            if (sessionId !== null && audioRef.current) {
                listenApi.complete(sessionId, audioRef.current.currentTime).catch(() => {});
            }
        };
    }, [sessionId]);

    const togglePlay = () => {
        if (!audioRef.current || !hlsLoaded) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
    };

    const updateBufferedRanges = () => {
        if (!audioRef.current) return;
        const buffered = audioRef.current.buffered;
        const ranges = [];
        for (let i = 0; i < buffered.length; i++) {
            ranges.push({ start: buffered.start(i), end: buffered.end(i) });
        }
        setBufferedRanges(ranges);
    };

    const handleTimeUpdate = () => {
        if (!audioRef.current) return;
        setCurrentTime(audioRef.current.currentTime);
        updateBufferedRanges();
    };

    const handleLoadedMetadata = () => {
        if (!audioRef.current) return;
        setDuration(audioRef.current.duration);
    };

    const handleSeek = (time: number) => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = time;
        setCurrentTime(time);
    };

    const handleTrackEnd = async () => {
        if (sessionId !== null && audioRef.current) {
            try {
                await listenApi.complete(sessionId, audioRef.current.duration);
            } catch {}
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="flex items-center gap-2 text-neutral-500">
                    <div className="w-4 h-4 rounded-full border-2 border-neutral-300 border-t-black animate-spin" />
                    <span className="text-sm">Loading track…</span>
                </div>
            </div>
        );
    }

    if (error || !track) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="text-center space-y-4">
                    <p className="text-sm text-red-500">{error || 'Track not found'}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="text-sm px-4 py-2 rounded-full border border-neutral-200 hover:border-neutral-400 transition-colors"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    if (quota && !quota.minutes_remaining) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="text-center space-y-4">
                    <p className="text-sm text-neutral-700">Daily listening limit reached.</p>
                    <button
                        onClick={() => navigate('/')}
                        className="text-sm px-4 py-2 rounded-full border border-neutral-200 hover:border-neutral-400 transition-colors"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-center py-8">
            <div className="w-full max-w-md space-y-6">
                {/* Quota badge */}
                <div className="flex justify-end">
                    {quota?.unlimited
                        ? <span className="text-xs text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-full px-3 py-1">Unlimited</span>
                        : quota && (
                            <span className="text-xs text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-full px-3 py-1">
                                {Math.floor(quota.minutes_remaining || 0)} min left
                            </span>
                          )
                    }
                </div>

                <div className="rounded-2xl border border-neutral-200/80 bg-white/70 backdrop-blur-sm p-8 shadow-sm">
                    <TrackInfo 
                        track={track} 
                        hlsLoaded={hlsLoaded} 
                        encrypted={streamInfo?.encrypted || false} 
                    />

                    <audio
                        ref={audioRef}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={handleTrackEnd}
                        className="hidden"
                    />

                    <BufferVisualization
                        bufferedRanges={bufferedRanges}
                        currentTime={currentTime}
                        duration={duration}
                    />

                    <PlayerControls
                        isPlaying={isPlaying}
                        currentTime={currentTime}
                        duration={duration}
                        hlsLoaded={hlsLoaded}
                        onTogglePlay={togglePlay}
                        onSeek={handleSeek}
                    />
                </div>
            </div>
        </div>
    );
}
