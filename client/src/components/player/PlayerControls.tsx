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

    const pct = duration ? (currentTime / duration) * 100 : 0;

    return (
        <div className="space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
                <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={(e) => onSeek(parseFloat(e.target.value))}
                    className="w-full h-1 rounded-full appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #0a0a0a 0%, #0a0a0a ${pct}%, #e5e5e5 ${pct}%, #e5e5e5 100%)`,
                    }}
                />
                <div className="flex justify-between text-xs text-neutral-400">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            {/* Play/Pause Button */}
            <div className="flex justify-center">
                <button
                    onClick={onTogglePlay}
                    disabled={!hlsLoaded}
                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm transition-all ${
                        hlsLoaded
                            ? 'bg-black text-white hover:bg-neutral-800 hover:scale-105 cursor-pointer'
                            : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                    }`}
                >
                    {isPlaying ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );
}
