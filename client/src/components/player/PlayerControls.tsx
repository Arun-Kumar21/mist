interface PlayerControlsProps {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    hlsLoaded: boolean;
    onTogglePlay: () => void;
    onSeek: (time: number) => void;
}

export default function PlayerControls({
    isPlaying,
    currentTime,
    duration,
    hlsLoaded,
    onTogglePlay,
    onSeek,
}: PlayerControlsProps) {
    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-4">
            {/* Play/Pause Button */}
            <div className="flex justify-center">
                <button
                    onClick={onTogglePlay}
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

            {/* Progress Bar */}
            <div className="space-y-2">
                <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={(e) => onSeek(parseFloat(e.target.value))}
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
    );
}
