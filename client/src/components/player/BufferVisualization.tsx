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
        <div className="space-y-1.5 mb-4">
            <p className="text-xs text-neutral-400">Buffer</p>
            <div className="relative w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                {/* Buffered chunks — data already fetched by HLS */}
                {bufferedRanges.map((range, index) => (
                    <div
                        key={index}
                        className="absolute h-full bg-neutral-400/60 rounded-full"
                        style={{
                            left: `${(range.start / duration) * 100}%`,
                            width: `${((range.end - range.start) / duration) * 100}%`,
                        }}
                    />
                ))}
                {/* Thin playhead — shows position only, does not fill */}
                {duration > 0 && (
                    <div
                        className="absolute top-0 w-0.5 h-full bg-neutral-600 rounded-full"
                        style={{ left: `${(currentTime / duration) * 100}%` }}
                    />
                )}
            </div>
        </div>
    );
}
