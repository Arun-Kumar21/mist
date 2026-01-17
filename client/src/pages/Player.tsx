import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { tracksApi, listenApi } from '../lib/api';
import type { Track } from '../types';
import { useAuthStore } from '../store/authStore';

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
    const {user} = useAuthStore();
    const navigate = useNavigate();

    const audioRef = useRef<HTMLAudioElement>(null);
    const hlsRef = useRef<any>(null);
    const heartbeatIntervalRef = useRef<any>(null);
    const quotaUpdateIntervalRef = useRef<any>(null);
    
    const [track, setTrack] = useState<Track | null>(null);
    const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [hlsLoaded, setHlsLoaded] = useState(false);
    const [bufferedRanges, setBufferedRanges] = useState<{ start: number; end: number }[]>([]);
    const [loadedFragments, setLoadedFragments] = useState<number>(0);
    const [totalFragments, setTotalFragments] = useState<number>(0);
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [quota, setQuota] = useState<any>(null);

    useEffect(() => {
        if (!id) return;

        const loadTrack = async () => {
            try {
                // Load track metadata
                const trackResponse = await tracksApi.getTrack(parseInt(id));
                setTrack(trackResponse.data.track);

                // Get stream info from tracks endpoint
                const streamResponse = await tracksApi.getStreamInfo(parseInt(id));
                const streamData = streamResponse.data;
                setStreamInfo(streamData);
                
                console.log('Stream info:', streamData);

                // Start listening session for quota tracking
                const sessionResponse = user 
                    ? await listenApi.startSession(parseInt(id), user)
                    : await listenApi.startSession(parseInt(id));
                
                console.log('Listening session started:', sessionResponse.data);
                setSessionId(sessionResponse.data.session_id);
                setQuota(sessionResponse.data.quota);

                // Note: HLS.js will automatically fetch the decryption key from the public endpoint
                // No need to pre-fetch it anymore
                if (streamData.encrypted) {
                    console.log('Stream is encrypted - HLS.js will fetch key from:', streamData.keyEndpoint);
                }
            } catch (err: any) {
                console.error('Error loading track:', err);
                if (err.response?.status === 429) {
                    const detail = err.response?.data?.detail;
                    if (typeof detail === 'object' && detail.error) {
                        setError(`${detail.error}. You've used ${Math.floor(detail.minutes_used)} of ${Math.floor(detail.quota_limit)} minutes today.`);
                    } else {
                        setError('Daily listening quota exceeded');
                    }
                } else {
                    setError(err.response?.data?.detail || err.message || 'Failed to load track');
                }
            } finally {
                setLoading(false);
            }
        };

        loadTrack();
    }, [id]);

    useEffect(() => {
        console.log('HLS Setup useEffect triggered');
        console.log('StreamInfo:', streamInfo);
        console.log('AudioRef:', audioRef.current);
        console.log('Loading state:', loading);
        console.log('Error state:', error);

        // Don't try to setup HLS while still loading or if there's an error
        if (loading || error) {
            console.log('Still loading or error present, waiting...');
            return;
        }

        if (!streamInfo?.streamUrl) {
            console.log('Missing streamInfo, exiting');
            return;
        }

        if (!audioRef.current) {
            console.log('AudioRef not ready yet, will retry...');
            // Give the DOM a chance to render
            const timer = setTimeout(() => {
                if (audioRef.current) {
                    console.log('Audio element now available, triggering re-render');
                    // Force a state update to trigger this effect again
                    setHlsLoaded(false);
                }
            }, 100);
            return () => clearTimeout(timer);
        }

        const audio = audioRef.current;

        console.log('Loading HLS.js (required for encrypted streams)');

        // Use hls.js for all browsers when stream is encrypted
        const loadHls = async () => {
            try {
                console.log('Importing HLS.js...');
                const Hls = (await import('hls.js')).default;
                console.log('HLS.js imported');

                if (!Hls.isSupported()) {
                    console.error('HLS not supported in this browser');
                    setError('HLS not supported in this browser');
                    return;
                }

                console.log('HLS is supported, creating instance...');

                // Custom loader to fix localhost key URIs
                class CustomKeyLoader extends Hls.DefaultConfig.loader {
                    constructor(config: any) {
                        super(config);
                    }

                    load(context: any, config: any, callbacks: any) {
                        const url = context.url;
                        
                        // Intercept localhost key requests and redirect to correct endpoint
                        if ((url.includes('localhost:8000') || url.includes('127.0.0.1:8000')) && 
                            url.includes('/keys/') && streamInfo?.keyEndpoint) {
                            console.log('🔄 Redirecting localhost key URI to:', streamInfo.keyEndpoint);
                            context.url = streamInfo.keyEndpoint;
                        }
                        
                        // Call parent loader with potentially modified URL
                        super.load(context, config, callbacks);
                    }
                }

                const hls = new Hls({
                    debug: true,
                    enableWorker: true,
                    lowLatencyMode: false,
                    loader: CustomKeyLoader,
                    // Configure XHR for proper CORS handling with S3
                    xhrSetup: (xhr: XMLHttpRequest, url: string) => {
                        console.log('XHR Setup for URL:', url);
                        // Set CORS mode for cross-origin requests
                        xhr.withCredentials = false;
                        // Log request headers
                        xhr.addEventListener('loadstart', () => {
                            console.log('XHR loadstart for:', url);
                        });
                        xhr.addEventListener('error', () => {
                            console.error('XHR error for:', url);
                        });
                        xhr.addEventListener('load', () => {
                            console.log('XHR load success for:', url, 'Status:', xhr.status);
                        });
                    }
                });

                hlsRef.current = hls;

                console.log('Loading HLS source:', streamInfo.streamUrl);
                
                // Add manifest loading event
                hls.on(Hls.Events.MANIFEST_LOADING, (_event, data) => {
                    console.log('MANIFEST_LOADING - Fetching:', data.url);
                });
                
                hls.on(Hls.Events.MANIFEST_LOADED, (_event, data) => {
                    console.log('MANIFEST_LOADED - Master playlist loaded successfully');
                    console.log('Levels available:', data.levels.length);
                    data.levels.forEach((level, index) => {
                        console.log(`Level ${index}: ${level.bitrate}bps - ${level.url}`);
                    });
                });
                
                hls.loadSource(streamInfo.streamUrl);
                hls.attachMedia(audio);

                hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
                    console.log('HLS manifest parsed', data);
                    setHlsLoaded(true);
                });

                hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
                    console.log('Level loaded');
                    if (data.details.fragments && data.details.fragments.length > 0) {
                        const firstFrag = data.details.fragments[0];
                        setTotalFragments(data.details.fragments.length);
                        console.log('Total fragments in playlist:', data.details.fragments.length);
                        if (firstFrag.decryptdata) {
                            console.log('Encryption detected in manifest');
                            console.log('Key URI in manifest:', firstFrag.decryptdata.uri);
                        }
                    }
                });

                hls.on(Hls.Events.FRAG_LOADING, (_event, data) => {
                    console.log('Loading fragment:', data.frag.url);
                    if (data.frag.decryptdata) {
                        console.log('Fragment key URI:', data.frag.decryptdata.uri);
                    }
                });

                hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
                    console.log('Fragment loaded:', data.frag.url);
                    setLoadedFragments(prev => prev + 1);
                    updateBufferedRanges();
                });

                hls.on(Hls.Events.KEY_LOADING, (_event, data) => {
                    console.log('KEY_LOADING event - HLS.js requesting decryption key');
                    console.log('Key URI:', data.frag.decryptdata?.uri);
                });

                hls.on(Hls.Events.KEY_LOADED, (_event, _data) => {
                    console.log('KEY_LOADED - Decryption key successfully loaded!');
                });

                hls.on(Hls.Events.ERROR, (_event, data) => {
                    console.error('HLS error:', data);
                    console.error('Error type:', data.type);
                    console.error('Error details:', data.details);
                    console.error('Error fatal:', data.fatal);
                    
                    if (data.response) {
                        console.error('HTTP Response code:', data.response.code);
                        console.error('HTTP Response URL:', data.response.url);
                    }
                    
                    if (data.frag) {
                        console.error('Failed fragment URL:', data.frag.url);
                    }
                    
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                console.error('Fatal network error occurred');
                                if (data.details === 'manifestLoadError') {
                                    setError('Failed to load playlist. Check S3 CORS and file accessibility.');
                                } else if (data.details === 'fragLoadError') {
                                    setError('Failed to load audio segment. Check S3 file permissions.');
                                } else if (data.details === 'keyLoadError') {
                                    setError('Failed to load decryption key. Check key endpoint.');
                                } else {
                                    setError(`Network error: ${data.details}`);
                                }
                                // Attempt recovery
                                console.log('Attempting to recover from network error...');
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.error('Fatal media error occurred');
                                setError(`Media error: ${data.details}`);
                                console.log('Attempting to recover from media error...');
                                hls.recoverMediaError();
                                break;
                            default:
                                console.error('Fatal unrecoverable error:', data);
                                setError(`Playback error: ${data.details}`);
                                hls.destroy();
                                break;
                        }
                    } else {
                        // Non-fatal error - log but continue
                        console.warn('Non-fatal HLS error:', data.details);
                    }
                });
            } catch (err) {
                console.error('Failed to load hls.js:', err);
                setError('Failed to initialize HLS player');
            }
        };

        loadHls();
        
        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [streamInfo, loading, error]);

    // Heartbeat effect - send updates while playing
    useEffect(() => {
        if (!isPlaying || sessionId === null) {
            // Clear interval if not playing
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }
            return;
        }

        heartbeatIntervalRef.current = setInterval(async () => {
            if (audioRef.current && sessionId !== null) {
                try {
                    const response = await listenApi.heartbeat(
                        sessionId,
                        audioRef.current.currentTime
                    );
                    console.log('Heartbeat sent:', response.data);
                    setQuota(response.data.quota);
                } catch (err) {
                    console.error('Heartbeat failed:', err);
                }
            }
        }, 5000); 

        return () => {
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }
        };
    }, [isPlaying, sessionId]);

    // Quota refresh effect - update quota display every 1 minute
    useEffect(() => {
        const fetchQuota = async () => {
            try {
                const response = await listenApi.getQuota();
                setQuota(response.data.quota);
                console.log('Quota refreshed:', response.data.quota);
            } catch (err) {
                console.error('Failed to refresh quota:', err);
            }
        };

        // Start interval to refresh quota every 60 seconds
        quotaUpdateIntervalRef.current = setInterval(fetchQuota, 60000);

        return () => {
            if (quotaUpdateIntervalRef.current) {
                clearInterval(quotaUpdateIntervalRef.current);
                quotaUpdateIntervalRef.current = null;
            }
        };
    }, []);

    // Cleanup effect - complete session on unmount or track end
    useEffect(() => {
        const handleComplete = async () => {
            if (sessionId !== null && audioRef.current) {
                try {
                    await listenApi.complete(
                        sessionId,
                        audioRef.current.currentTime
                    );
                    console.log('Session completed');
                } catch (err) {
                    console.error('Failed to complete session:', err);
                }
            }
        };

        return () => {
            handleComplete();
        };
    }, [sessionId]);

    const updateBufferedRanges = () => {
        if (!audioRef.current) return;
        
        const buffered = audioRef.current.buffered;
        const ranges: { start: number; end: number }[] = [];
        
        for (let i = 0; i < buffered.length; i++) {
            ranges.push({
                start: buffered.start(i),
                end: buffered.end(i)
            });
        }
        
        setBufferedRanges(ranges);
    };

    const togglePlay = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
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

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!audioRef.current) return;
        const time = parseFloat(e.target.value);
        audioRef.current.currentTime = time;
        setCurrentTime(time);
    };

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-300 p-4">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <h1 className="text-xl font-bold">Music Player</h1>
                    {quota && (
                        <div className="text-sm text-gray-600">
                            {quota.unlimited ? (
                                <span>Unlimited listening</span>
                            ) : (
                                <span>
                                    Quota: {Math.floor(quota.minutes_remaining)}min / {Math.floor(quota.quota_limit)}min remaining
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-4xl p-6">
                <div className="bg-white border border-gray-300 p-8">
                    {/* Track Info */}
                    <div className="mb-8">
                        <h2 className="font-bold mb-2">{track.title}</h2>
                        <p className="text-gray-600 mb-1">{track.artist_name}</p>
                        {track.album_title && (
                            <p className="text-gray-500">{track.album_title}</p>
                        )}
                        {track.genre_top && (
                            <span className="inline-block mt-3 px-3 py-1 bg-gray-100 text-sm">
                                {track.genre_top}
                            </span>
                        )}
                    </div>

                    {/* HLS Status */}
                    <div className="mb-4 space-y-2">
                        {hlsLoaded ? (
                            <>
                                <div className="text-sm text-green-600">
                                    HLS Stream Ready
                                </div>
                                {streamInfo?.encrypted && (
                                    <div className="text-xs text-blue-600">
                                        Encrypted Stream (AES-128)
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-sm text-gray-500">
                                Loading encrypted stream...
                            </div>
                        )}
                    </div>

                    {/* Audio Element */}
                    <audio
                        ref={audioRef}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={async () => {
                            if (sessionId !== null && audioRef.current) {
                                try {
                                    await listenApi.complete(sessionId, audioRef.current.duration);
                                    console.log('Track completed - session ended');
                                } catch (err) {
                                    console.error('Failed to complete session:', err);
                                }
                            }
                        }}
                        className="hidden"
                    />

                    {/* Player Controls */}
                    <div className="space-y-4">
                        {/* Play/Pause Button */}
                        <div className="flex justify-center">
                            <button
                                onClick={togglePlay}
                                disabled={!hlsLoaded}
                                className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${
                                    hlsLoaded
                                        ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                                        : 'bg-gray-400 cursor-not-allowed'
                                }`}
                            >
                                {isPlaying ? (
                                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                                        <rect x="6" y="4" width="4" height="16" />
                                        <rect x="14" y="4" width="4" height="16" />
                                    </svg>
                                ) : (
                                    <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        {/* Buffer Visualization */}
                        <div className="space-y-2">
                            <div className="text-xs text-gray-600 mb-1">Buffer Status:</div>
                            <div className="relative w-full h-6 bg-gray-200 rounded overflow-hidden">
                                {/* Buffered chunks (green) */}
                                {bufferedRanges.map((range, index) => (
                                    <div
                                        key={index}
                                        className="absolute h-full bg-green-400 opacity-60"
                                        style={{
                                            left: `${(range.start / duration) * 100}%`,
                                            width: `${((range.end - range.start) / duration) * 100}%`,
                                        }}
                                    />
                                ))}
                                {/* Current playback position (blue) */}
                                <div
                                    className="absolute h-full bg-blue-600"
                                    style={{
                                        left: 0,
                                        width: `${(currentTime / duration) * 100}%`,
                                    }}
                                />
                                {/* Playhead marker (red line) */}
                                <div
                                    className="absolute h-full w-1 bg-red-600"
                                    style={{
                                        left: `${(currentTime / duration) * 100}%`,
                                    }}
                                />
                            </div>
                            <div className="flex gap-4 text-xs text-gray-600">
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 bg-blue-600 rounded"></div>
                                    <span>Played</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 bg-green-400 opacity-60 rounded"></div>
                                    <span>Buffered</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 bg-gray-200 rounded"></div>
                                    <span>Not loaded</span>
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                            <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                value={currentTime}
                                onChange={handleSeek}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                style={{
                                    background: `linear-gradient(to right, #2563eb 0%, #2563eb ${
                                        (currentTime / duration) * 100
                                    }%, #e5e7eb ${(currentTime / duration) * 100}%, #e5e7eb 100%)`,
                                }}
                            />
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
