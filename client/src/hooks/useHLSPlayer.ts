import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface StreamInfo {
    streamUrl: string;
    keyEndpoint: string;
    encrypted: boolean;
}

function getAuthToken(): string | null {
    try {
        const raw = localStorage.getItem('auth-storage');
        if (!raw) return null;
        const { state } = JSON.parse(raw);
        return state?.token ?? null;
    } catch {
        return null;
    }
}

export function useHLSPlayer(
    streamInfo: StreamInfo | null,
    audioRef: React.RefObject<HTMLAudioElement | null>,
    loading: boolean,
    error: string
) {
    const hlsRef = useRef<Hls | null>(null);
    const [hlsLoaded, setHlsLoaded] = useState(false);

    useEffect(() => {
        if (loading || error || !streamInfo?.streamUrl || !audioRef.current) {
            if (!audioRef.current) {
                const timer = setTimeout(() => {
                    if (audioRef.current) setHlsLoaded(false);
                }, 100);
                return () => clearTimeout(timer);
            }
            return;
        }

        const audio = audioRef.current;
        const loadHls = async () => {
            try {
                const HlsLib = (await import('hls.js')).default;
                if (!HlsLib.isSupported()) {
                    console.error('HLS not supported');
                    return;
                }

                class CustomKeyLoader extends HlsLib.DefaultConfig.loader {
                    constructor(config: any) {
                        super(config);
                    }
                    load(context: any, config: any, callbacks: any) {
                        const url = context.url;
                        if ((url.includes('localhost:8000') || url.includes('127.0.0.1:8000')) &&
                            url.includes('/keys/') && streamInfo?.keyEndpoint) {
                            context.url = streamInfo.keyEndpoint;
                        }
                        super.load(context, config, callbacks);
                    }
                }

                const hls = new HlsLib({
                    debug: false,
                    enableWorker: true,
                    loader: CustomKeyLoader,
                    xhrSetup: (xhr: XMLHttpRequest, url: string) => {
                        xhr.withCredentials = false;
                        if (url.includes('/keys/') || url.includes('/api/keys/')) {
                            const token = getAuthToken();
                            if (token) {
                                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                            }
                        }
                    }
                });

                hlsRef.current = hls;
                hls.loadSource(streamInfo.streamUrl);
                hls.attachMedia(audio);

                hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
                    setHlsLoaded(true);
                });

                hls.on(HlsLib.Events.ERROR, (_event, data) => {
                    if (data.fatal) {
                        switch (data.type) {
                            case HlsLib.ErrorTypes.NETWORK_ERROR:
                                hls.startLoad();
                                break;
                            case HlsLib.ErrorTypes.MEDIA_ERROR:
                                hls.recoverMediaError();
                                break;
                            default:
                                console.error('Fatal HLS error:', data.details);
                                hls.destroy();
                                break;
                        }
                    }
                });
            } catch (err) {
                console.error('Failed to initialize HLS:', err);
            }
        };

        loadHls();

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [streamInfo, loading, error, audioRef]);

    return { hlsLoaded };
}
