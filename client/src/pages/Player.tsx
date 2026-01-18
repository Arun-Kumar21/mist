import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { tracksApi, listenApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
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
    const { user } = useAuthStore();
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

    // Load track and stream info
    useEffect(() => {
        if (!id) return;

        const loadTrack = async () => {
            try {
                const trackResponse = await tracksApi.getTrack(parseInt(id));
                setTrack(trackResponse.data);

                const streamResponse = await tracksApi.getStreamInfo(parseInt(id));
                setStreamInfo(streamResponse.data);

                // Start listening session for quota tracking
                const sessionResponse = user 
                    ? await listenApi.startSession(parseInt(id), user)
                    : await listenApi.startSession(parseInt(id));
                
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
    }, [id, user]);

    // Heartbeat while playing
    useEffect(() => {
        if (!isPlaying || sessionId === null || !audioRef.current) return;

        const heartbeatInterval = setInterval(async () => {
            if (audioRef.current && sessionId !== null) {
                try {
                    const response = await listenApi.heartbeat(
                        sessionId,
                        audioRef.current.currentTime
                    );
                    setQuota(response.data.quota);
                } catch (err) {
                    // Heartbeat failed, will retry
                }
            }
        }, 5000);

        return () => clearInterval(heartbeatInterval);
    }, [isPlaying, sessionId]);

    // Complete session on track end or unmount
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
            } catch (err) {
                // Session completion failed
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg">Loading track...</div>
            </div>
        );
    }

    if (error || !track) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-600 mb-4">{error || 'Track not found'}</div>
                    <button
                        onClick={() => navigate('/')}
                        className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    if (quota && !quota.minutes_remaining) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className='text-red-500 mb-4'>Limit reached for today!</h1>
                    <button
                        onClick={() => navigate('/')}
                        className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-300 p-4">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <h1 className="text-xl font-bold">Music Player</h1>
                    <div className="text-sm text-gray-600">
                        {!quota && <span>Loading quota...</span>}
                        {quota && quota.unlimited && <span>Unlimited listening</span>}
                        {quota && !quota.unlimited && (
                            <span>
                                Remaining: {Math.floor(quota.minutes_remaining || 0)}min of {Math.floor(quota.quota_limit || 0)}min
                            </span>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-4xl p-6">
                <div className="bg-white border border-gray-300 p-8">
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
            </main>
        </div>
    );
}
