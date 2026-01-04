import ffmpeg
import os
import logging

logger = logging.getLogger(__name__)


def convert_to_hls(input_path, output_dir, track_id, encryption_key=None, key_uri=None):
    """
    Convert audio file to HLS format with multiple bitrates (64k, 128k, 192k).

    Args:
        input_path: Path to input audio file
        output_dir: Base directory for HLS output
        track_id: Unique track identifier
        encryption_key: Optional 16-byte AES-128 encryption key for HLS encryption
        key_uri: Optional URI where clients can fetch the decryption key (e.g., 'https://api.example.com/api/keys/{track_id}')

    Returns:
        dict: Paths to generated HLS playlists and segment directories

    Raises:
        FileNotFoundError: If input file doesn't exist or FFmpeg not found
        ffmpeg.Error: If conversion fails
        ValueError: If encryption_key is provided but key_uri is not
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")
    
    if encryption_key and not key_uri:
        raise ValueError("key_uri must be provided when encryption_key is specified")
    
    if encryption_key and len(encryption_key) != 16:
        raise ValueError("encryption_key must be exactly 16 bytes for AES-128")

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
        'variants': {},
        'encrypted': encryption_key is not None
    }

    # Setup encryption if key is provided
    key_info_file = None
    key_file = None
    
    if encryption_key:
        key_info_file, key_file = _create_key_info_file(track_dir, encryption_key, key_uri)
        logger.info(f"Encryption enabled for track {track_id}")

    try:
        # Convert each bitrate variant
        for bitrate_label, bitrate_value in bitrates.items():
            # Create bitrate-specific directory
            bitrate_dir = os.path.join(track_dir, bitrate_label)
            os.makedirs(bitrate_dir, exist_ok=True)

            # Output paths
            playlist_path = os.path.join(bitrate_dir, 'playlist.m3u8')
            segment_pattern = os.path.join(bitrate_dir, 'segment_%03d.ts')

            # Build FFmpeg output options
            output_options = {
                'format': 'hls',
                'audio_bitrate': f'{bitrate_value}k',
                'acodec': 'aac',
                'hls_time': 10,  # 10 second segments
                'hls_segment_filename': segment_pattern,
                'hls_playlist_type': 'vod',
                'hls_flags': 'independent_segments'
            }
            
            # Add encryption if enabled
            if encryption_key:
                output_options['hls_key_info_file'] = key_info_file

            # FFmpeg conversion
            (
                ffmpeg
                .input(input_path)
                .output(playlist_path, **output_options)
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
    finally:
        # Cleanup temporary key info file (key file can stay for re-encryption)
        if key_info_file and os.path.exists(key_info_file):
            try:
                os.remove(key_info_file)
            except Exception as e:
                logger.warning(f"Failed to cleanup key info file: {e}")


def _create_key_info_file(track_dir, encryption_key, key_uri):
    """
    Create HLS key info file for FFmpeg encryption.
    
    The key info file format:
    Line 1: Key URI (where clients fetch the key)
    Line 2: Path to key file (for FFmpeg to read during encryption)
    Line 3: IV in hex (optional, we let FFmpeg generate it)
    
    Args:
        track_dir: Directory to store key files
        encryption_key: 16-byte AES-128 encryption key
        key_uri: URI where clients can fetch the decryption key
        
    Returns:
        tuple: (key_info_file_path, key_file_path)
    """
    # Write the encryption key to a file
    key_file = os.path.join(track_dir, 'enc.key')
    with open(key_file, 'wb') as f:
        f.write(encryption_key)
    
    # Create key info file for FFmpeg
    key_info_file = os.path.join(track_dir, 'enc.keyinfo')
    with open(key_info_file, 'w') as f:
        f.write(f"{key_uri}\n")  # Line 1: Key URI
        f.write(f"{key_file}\n")  # Line 2: Key file path
        # Line 3: IV is optional - FFmpeg will generate random IV per segment
    
    logger.info(f"Created key info file: {key_info_file}")
    return key_info_file, key_file


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


def convert_single_bitrate(input_path, output_dir, track_id, bitrate='128k', encryption_key=None, key_uri=None):
    """
    Convert audio file to HLS format with a single bitrate.

    Args:
        input_path: Path to input audio file
        output_dir: Base directory for HLS output
        track_id: Unique track identifier
        bitrate: Target bitrate (e.g., '64k', '128k', '192k')
        encryption_key: Optional 16-byte AES-128 encryption key for HLS encryption
        key_uri: Optional URI where clients can fetch the decryption key

    Returns:
        dict: Paths to generated HLS playlist and segments
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")
    
    if encryption_key and not key_uri:
        raise ValueError("key_uri must be provided when encryption_key is specified")
    
    if encryption_key and len(encryption_key) != 16:
        raise ValueError("encryption_key must be exactly 16 bytes for AES-128")

    # Create output directory
    track_dir = os.path.join(output_dir, str(track_id))
    os.makedirs(track_dir, exist_ok=True)

    # Output paths
    playlist_path = os.path.join(track_dir, 'playlist.m3u8')
    segment_pattern = os.path.join(track_dir, 'segment_%03d.ts')

    # Setup encryption if key is provided
    key_info_file = None
    key_file = None
    
    if encryption_key:
        key_info_file, key_file = _create_key_info_file(track_dir, encryption_key, key_uri)
        logger.info(f"Encryption enabled for track {track_id}")

    try:
        # Build FFmpeg output options
        output_options = {
            'format': 'hls',
            'audio_bitrate': bitrate,
            'acodec': 'aac',
            'hls_time': 10,
            'hls_segment_filename': segment_pattern,
            'hls_playlist_type': 'vod'
        }
        
        # Add encryption if enabled
        if encryption_key:
            output_options['hls_key_info_file'] = key_info_file

        (
            ffmpeg
            .input(input_path)
            .output(playlist_path, **output_options)
            .overwrite_output()
            .run(capture_stdout=True, capture_stderr=True)
        )

        logger.info(f"Created {bitrate} HLS stream for track {track_id}")

        return {
            'track_id': track_id,
            'playlist': playlist_path,
            'directory': track_dir,
            'bitrate': bitrate,
            'encrypted': encryption_key is not None
        }

    except ffmpeg.Error as e:
        error_msg = e.stderr.decode('utf8') if e.stderr else str(e)
        logger.error(f"FFmpeg error: {error_msg}")
        raise
    finally:
        # Cleanup temporary key info file
        if key_info_file and os.path.exists(key_info_file):
            try:
                os.remove(key_info_file)
            except Exception as e:
                logger.warning(f"Failed to cleanup key info file: {e}")
