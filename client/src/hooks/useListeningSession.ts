import { useEffect, useRef, useState } from 'react';
import { listenApi } from '../lib/api';

export function useListeningSession(
    trackId: number | undefined,
    isPlaying: boolean,
    audioRef: React.RefObject<HTMLAudioElement | null>,
    user: any
) {
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [quota, setQuota] = useState<any>(null);
    const heartbeatIntervalRef = useRef<any>(null);

    // Start session
    useEffect(() => {
        if (!trackId) return;

        const startSession = async () => {
            try {
                const response = user 
                    ? await listenApi.startSession(trackId, user)
                    : await listenApi.startSession(trackId);
                setSessionId(response.data.session_id);
                setQuota(response.data.quota);
            } catch (err) {
                console.error('Failed to start session:', err);
            }
        };

        startSession();
    }, [trackId, user]);

    // Heartbeat while playing
    useEffect(() => {
        if (!isPlaying || sessionId === null) {
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
                    setQuota(response.data.quota);
                } catch (err) {
                    console.error('Heartbeat failed:', err);
                }
            }
        }, 5000);

        return () => {
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
            }
        };
    }, [isPlaying, sessionId, audioRef]);

    return { sessionId, quota };
}
