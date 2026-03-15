import os
import shutil
import logging

from services.s3_service import download_file_from_s3, upload_directory_to_s3, generate_object_url
from processing.audio_features import extract_audio_features
from processing.embedding_utils import create_embedding_vector
from processing.hls_converter import convert_to_hls
from shared.db.controllers import (
    ProcessingJobRepository,
    TrackRepository,
    AudioFeaturesRepository,
    TrackEmbeddingRepository,
    TrackEncryptionKeysRepository,
)

logger = logging.getLogger(__name__)


def process_audio_file(job_id, s3_input_key, metadata, api_base_url):
    temp_dir = f'/tmp/{job_id}'
    track_id = None

    try:
        ProcessingJobRepository.update_status(job_id, 'processing')
        os.makedirs(temp_dir, exist_ok=True)

        filename = s3_input_key.split('/')[-1]
        local_audio_path = os.path.join(temp_dir, filename)
        download_file_from_s3(s3_input_key, local_audio_path)

        features = extract_audio_features(local_audio_path)
        if not features:
            raise ValueError("Failed to extract audio features")

        embedding_vector = create_embedding_vector(features)

        track_data = {
            'title': metadata.get('title', 'Unknown'),
            'artist_name': metadata.get('artist_name') or metadata.get('artist', 'Unknown Artist'),
            'album_title': metadata.get('album_title') or metadata.get('album'),
            'genre_top': metadata.get('genre_top') or metadata.get('genre'),
            'cover_image_url': metadata.get('cover_image_url') or metadata.get('image_url'),
            'listens': metadata.get('listens', 0),
            'interest': metadata.get('interest', 0),
            'processing_status': 'processing'
        }
        track_id = TrackRepository.create(track_data)

        TrackEncryptionKeysRepository.create(track_id=track_id)
        encryption_key = TrackEncryptionKeysRepository.get_key_bytes(track_id)

        hls_output_dir = os.path.join(temp_dir, 'hls')
        key_uri = f"{api_base_url}/api/v1/keys/{track_id}"

        convert_to_hls(
            input_path=local_audio_path,
            output_dir=hls_output_dir,
            track_id=track_id,
            encryption_key=encryption_key,
            key_uri=key_uri
        )

        hls_s3_prefix = f"audio/hls/{track_id}"
        track_hls_dir = os.path.join(hls_output_dir, str(track_id))
        upload_directory_to_s3(track_hls_dir, hls_s3_prefix)

        cdn_url = generate_object_url(f"{hls_s3_prefix}/master.m3u8")

        duration_sec = features.get('duration', 0)
        TrackRepository.update(track_id, {
            'cdn_url': cdn_url,
            'duration_sec': duration_sec,
            'processing_status': 'completed'
        })

        features_copy = {k: v for k, v in features.items() if k != 'duration'}
        features_copy['track_id'] = track_id
        AudioFeaturesRepository.create(features_copy)

        TrackEmbeddingRepository.create({
            'track_id': track_id,
            'embedding_vector': embedding_vector.tolist()
        })

        ProcessingJobRepository.link_track(job_id, track_id)
        ProcessingJobRepository.update_status(job_id, 'completed')

        logger.info(f"Successfully processed job {job_id} -> track {track_id}")
        return {'track_id': track_id, 'cdn_url': cdn_url}

    except Exception as e:
        logger.error(f"Error processing job {job_id}: {e}")
        ProcessingJobRepository.update_status(job_id, 'failed', error_message=str(e))
        if track_id:
            TrackRepository.update(track_id, {'processing_status': 'failed'})
        raise

    finally:
        if os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
            except Exception as e:
                logger.warning(f"Failed to cleanup temp dir {temp_dir}: {e}")
