import type { Track } from '../../types';
import { getGradient } from '@/lib/gradient';

interface TrackInfoProps {
    track: Track;
    hlsLoaded: boolean;
    encrypted: boolean;
}

export default function TrackInfo({ track, hlsLoaded, encrypted }: TrackInfoProps) {
    return (
        <div className="mb-8 space-y-4">
            {/* Cover art */}
            <div
                className="w-full rounded-2xl"
                style={{ background: getGradient(track.track_id), height: '180px' }}
            />

            <div>
                <h2 className="text-xl font-bold tracking-tight mb-1">{track.title}</h2>
                <p className="text-sm text-neutral-500">{track.artist_name}</p>
                {track.album_title && (
                    <p className="text-xs text-neutral-400 mt-0.5">{track.album_title}</p>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                {track.genre_top && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200">
                        {track.genre_top}
                    </span>
                )}
                {hlsLoaded ? (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200">
                        {encrypted ? 'AES-128 Encrypted' : 'Stream ready'}
                    </span>
                ) : (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-50 text-neutral-400 border border-neutral-200 animate-pulse">
                        Loading stream…
                    </span>
                )}
            </div>
        </div>
    );
}
