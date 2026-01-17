interface BufferVisualizationProps {
    bufferedRanges: { start: number; end: number }[];
    currentTime: number;
    duration: number;
}

export default function BufferVisualization({
    bufferedRanges,
    currentTime,
    duration,
}: BufferVisualizationProps) {
    return (
        <div className="space-y-2">
            <div className="text-xs text-gray-600 mb-1">Buffer Status:</div>
            <div className="relative w-full h-6 bg-gray-200 rounded overflow-hidden">
                {/* Buffered chunks */}
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
                {/* Current playback position */}
                <div
                    className="absolute h-full bg-blue-600"
                    style={{
                        left: 0,
                        width: `${(currentTime / duration) * 100}%`,
                    }}
                />
                {/* Playhead marker */}
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
    );
}
