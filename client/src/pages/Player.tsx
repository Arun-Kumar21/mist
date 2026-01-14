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
    const [decryptionKey, setDecryptionKey] = useState<ArrayBuffer | null>(null);
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

                // If encrypted, pre-fetch the decryption key
                if (streamData.encrypted && streamData.keyEndpoint) {
                    console.log('Fetching decryption key from:', streamData.keyEndpoint);
                    
                    const authStorage = localStorage.getItem('auth-storage');
                    let token = '';
                    if (authStorage) {
                        try {
                            const { state } = JSON.parse(authStorage);
                            token = state?.token || '';
                        } catch (e) {
                            console.error('Failed to parse auth storage', e);
                        }
                    }

                    const keyResponse = await fetch(streamData.keyEndpoint, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (!keyResponse.ok) {
                        throw new Error(`Failed to fetch decryption key: ${keyResponse.status}`);
                    }

                    const keyData = await keyResponse.arrayBuffer();
                    console.log('Decryption key fetched, size:', keyData.byteLength, 'bytes');
                    setDecryptionKey(keyData);
                }
            } catch (err: any) {
                console.error('Error loading track:', err);
                setError(err.response?.data?.detail || err.message || 'Failed to load track');
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
        console.log('Decryption Key:', decryptionKey ? `${decryptionKey.byteLength} bytes` : 'null');

        if (!streamInfo?.streamUrl) {
            console.log('Missing streamInfo, exiting');
            return;
        }

        if (!audioRef.current) {
            console.log('AudioRef not ready yet, exiting');
            return;
        }

        // If encrypted, wait for key to be fetched
        if (streamInfo.encrypted && !decryptionKey) {
            console.log('Waiting for decryption key...');
            return;
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

                const hls = new Hls({
                    debug: true,
                    enableWorker: true,
                    lowLatencyMode: false,
                    xhrSetup: (xhr: XMLHttpRequest, url: string) => {
                        console.log('XHR Setup - URL:', url);
                        
                        // If this is a key request, we need to intercept and return our pre-fetched key
                        if (url.includes('.key') && decryptionKey) {
                            console.log('Key request detected! Intercepting...');
                            
                            // Prevent the actual request
                            const originalSend = xhr.send.bind(xhr);
                            const originalOpen = xhr.open.bind(xhr);
                            
                            let isIntercepted = false;
                            
                            xhr.open = function(method: string, _url: string | URL, async?: boolean) {
                                console.log('Intercepted open() - not making real request');
                                isIntercepted = true;
                                // Open to a dummy URL to prevent actual request
                                return originalOpen(method, 'data:text/plain,dummy', async !== false);
                            };
                            
                            xhr.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
                                if (isIntercepted) {
                                    console.log('Returning pre-fetched key instead of making request');
                                    
                                    setTimeout(() => {
                                        // Set response properties
                                        Object.defineProperty(xhr, 'status', {
                                            get: () => 200,
                                            configurable: true
                                        });
                                        Object.defineProperty(xhr, 'readyState', {
                                            get: () => 4,
                                            configurable: true
                                        });
                                        Object.defineProperty(xhr, 'response', {
                                            get: () => decryptionKey,
                                            configurable: true
                                        });
                                        Object.defineProperty(xhr, 'responseType', {
                                            get: () => 'arraybuffer',
                                            set: () => {},
                                            configurable: true
                                        });
                                        
                                        console.log('Dispatching load event with decryption key');
                                        
                                        // Dispatch events
                                        if (xhr.onreadystatechange) {
                                            xhr.onreadystatechange.call(xhr, new Event('readystatechange'));
                                        }
                                        if (xhr.onload) {
                                            xhr.onload.call(xhr, new ProgressEvent('load'));
                                        }
                                        xhr.dispatchEvent(new ProgressEvent('load'));
                                    }, 0);
                                } else {
                                    return originalSend.call(xhr, body);
                                }
                            };
                        }
                    }
                });

                hlsRef.current = hls;

                console.log('Loading HLS source:', streamInfo.streamUrl);
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
                    
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                console.error('Network error, attempting recovery...');
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.error('Media error, attempting recovery...');
                                hls.recoverMediaError();
                                break;
                            default:
                                console.error('Fatal error:', data);
                                setError(`Playback error: ${data.details}`);
                                hls.destroy();
                                break;
                        }
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
    }, [streamInfo, decryptionKey]);

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
