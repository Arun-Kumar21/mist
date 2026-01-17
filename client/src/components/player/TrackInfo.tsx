import type { Track } from '../../types';

interface TrackInfoProps {
    track: Track;
    hlsLoaded: boolean;
    encrypted: boolean;
}

export default function TrackInfo({ track, hlsLoaded, encrypted }: TrackInfoProps) {
    return (
        <>
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

            <div className="mb-4 space-y-2">
                {hlsLoaded ? (
                    <>
                        <div className="text-sm text-green-600">HLS Stream Ready</div>
                        {encrypted && (
                            <div className="text-xs text-blue-600">
                                Encrypted Stream (AES-128)
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-sm text-gray-500">Loading stream...</div>
                )}
            </div>
        </>
    );
}
