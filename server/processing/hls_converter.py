import ffmpeg
import os
import logging

logger = logging.getLogger(__name__)


def convert_to_hls(input_path, output_dir, track_id):
    """
    Convert audio file to HLS format with multiple bitrates (64k, 128k, 192k).

    Args:
        input_path: Path to input audio file
        output_dir: Base directory for HLS output
        track_id: Unique track identifier

    Returns:
        dict: Paths to generated HLS playlists and segment directories

    Raises:
        FileNotFoundError: If input file doesn't exist or FFmpeg not found
        ffmpeg.Error: If conversion fails
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    track_dir = os.path.join(output_dir, str(track_id))
    os.makedirs(track_dir, exist_ok=True)

    bitrates = {
        '64k': 64,
        '128k': 128,
        '192k': 192
    }

    results = {
        'track_id': track_id,
        'master_playlist': os.path.join(track_dir, 'master.m3u8'),
        'variants': {}
    }

    try:
        # Convert each bitrate variant
        for bitrate_label, bitrate_value in bitrates.items():
            # Create bitrate-specific directory
            bitrate_dir = os.path.join(track_dir, bitrate_label)
            os.makedirs(bitrate_dir, exist_ok=True)

            # Output paths
            playlist_path = os.path.join(bitrate_dir, 'playlist.m3u8')
            segment_pattern = os.path.join(bitrate_dir, 'segment_%03d.ts')

            # FFmpeg conversion
            (
                ffmpeg
                .input(input_path)
                .output(
                    playlist_path,
                    format='hls',
                    audio_bitrate=f'{bitrate_value}k',
                    acodec='aac',
                    hls_time=10,  # 10 second segments
                    hls_segment_filename=segment_pattern,
                    hls_playlist_type='vod',
                    hls_flags='independent_segments'
                )
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )

            results['variants'][bitrate_label] = {
                'playlist': playlist_path,
                'directory': bitrate_dir,
                'bitrate': bitrate_value
            }

            logger.info(f"Created {bitrate_label} variant for track {track_id}")

        # Create master playlist
        _create_master_playlist(track_dir, bitrates)

        logger.info(f"Successfully converted track {track_id} to HLS with {len(bitrates)} variants")
        return results

    except ffmpeg.Error as e:
        error_msg = e.stderr.decode('utf8') if e.stderr else str(e)
        logger.error(f"FFmpeg error converting track {track_id}: {error_msg}")
        raise
    except FileNotFoundError as e:
        logger.error("FFmpeg executable not found. Please install FFmpeg.", e)
        raise
    except Exception as e:
        logger.error(f"Unexpected error converting track {track_id}: {e}")
        raise


def _create_master_playlist(track_dir, bitrates):
    """Create HLS master playlist that references all bitrate variants."""
    master_path = os.path.join(track_dir, 'master.m3u8')

    with open(master_path, 'w') as f:
        f.write('#EXTM3U\n')
        f.write('#EXT-X-VERSION:3\n\n')

        for bitrate_label, bitrate_value in bitrates.items():
            f.write(f'#EXT-X-STREAM-INF:BANDWIDTH={bitrate_value * 1000},CODECS="mp4a.40.2"\n')
            f.write(f'{bitrate_label}/playlist.m3u8\n\n')

    logger.info(f"Created master playlist: {master_path}")


def convert_single_bitrate(input_path, output_dir, track_id, bitrate='128k'):
    """
    Convert audio file to HLS format with a single bitrate.

    Args:
        input_path: Path to input audio file
        output_dir: Base directory for HLS output
        track_id: Unique track identifier
        bitrate: Target bitrate (e.g., '64k', '128k', '192k')

    Returns:
        dict: Paths to generated HLS playlist and segments
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # Create output directory
    track_dir = os.path.join(output_dir, str(track_id))
    os.makedirs(track_dir, exist_ok=True)

    # Output paths
    playlist_path = os.path.join(track_dir, 'playlist.m3u8')
    segment_pattern = os.path.join(track_dir, 'segment_%03d.ts')

    try:
        (
            ffmpeg
            .input(input_path)
            .output(
                playlist_path,
                format='hls',
                audio_bitrate=bitrate,
                acodec='aac',
                hls_time=10,
                hls_segment_filename=segment_pattern,
                hls_playlist_type='vod'
            )
            .overwrite_output()
            .run(capture_stdout=True, capture_stderr=True)
        )

        logger.info(f"Created {bitrate} HLS stream for track {track_id}")

        return {
            'track_id': track_id,
            'playlist': playlist_path,
            'directory': track_dir,
            'bitrate': bitrate
        }

    except ffmpeg.Error as e:
        error_msg = e.stderr.decode('utf8') if e.stderr else str(e)
        logger.error(f"FFmpeg error: {error_msg}")
        raise
