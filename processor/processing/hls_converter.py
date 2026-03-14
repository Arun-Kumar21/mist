import ffmpeg
import os
import logging

logger = logging.getLogger(__name__)


def _create_key_info_file(track_dir, encryption_key, key_uri):
    key_file = os.path.join(track_dir, 'enc.key')
    key_info_file = os.path.join(track_dir, 'enc.keyinfo')
    with open(key_file, 'wb') as f:
        f.write(encryption_key)
    with open(key_info_file, 'w', encoding='utf-8') as f:
        f.write(f"{key_uri}\n{key_file}\n")
    return key_info_file, key_file


def _create_master_playlist(master_path, variants):
    with open(master_path, 'w', encoding='utf-8') as f:
        f.write('#EXTM3U\n')
        f.write('#EXT-X-VERSION:3\n')
        for v in variants:
            f.write(f"#EXT-X-STREAM-INF:BANDWIDTH={v['bandwidth']},CODECS=\"mp4a.40.2\"\n")
            f.write(f"{v['uri']}\n")


def convert_to_hls(input_path, output_dir, track_id, encryption_key=None, key_uri=None):
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if encryption_key and not key_uri:
        raise ValueError("key_uri must be provided when encryption_key is specified")

    track_dir = os.path.join(output_dir, str(track_id))
    os.makedirs(track_dir, exist_ok=True)

    bitrates = {'64k': 64, '128k': 128, '192k': 192}
    results = {'track_id': track_id, 'master_playlist': os.path.join(track_dir, 'master.m3u8'), 'variants': {}}

    key_info_file = None
    key_file = None
    if encryption_key:
        key_info_file, key_file = _create_key_info_file(track_dir, encryption_key, key_uri)

    try:
        variants_for_master = []
        for bitrate_label, bitrate_value in bitrates.items():
            bitrate_dir = os.path.join(track_dir, bitrate_label)
            os.makedirs(bitrate_dir, exist_ok=True)

            playlist_path = os.path.join(bitrate_dir, 'playlist.m3u8')
            segment_pattern = os.path.join(bitrate_dir, 'segment_%03d.ts')

            output_options = {
                'format': 'hls',
                'audio_bitrate': f'{bitrate_value}k',
                'acodec': 'aac',
                'hls_time': 10,
                'hls_segment_filename': segment_pattern,
                'hls_playlist_type': 'vod',
                'hls_flags': 'independent_segments'
            }
            if key_info_file:
                output_options['hls_key_info_file'] = key_info_file

            (
                ffmpeg
                .input(input_path)
                .output(playlist_path, **output_options)
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )

            results['variants'][bitrate_label] = {
                'playlist': playlist_path,
                'bitrate_kbps': bitrate_value,
                'bandwidth': bitrate_value * 1000
            }
            variants_for_master.append({'bandwidth': bitrate_value * 1000, 'uri': f"{bitrate_label}/playlist.m3u8"})

        _create_master_playlist(results['master_playlist'], variants_for_master)
        return results

    finally:
        if key_file and os.path.exists(key_file):
            os.remove(key_file)
        if key_info_file and os.path.exists(key_info_file):
            os.remove(key_info_file)
