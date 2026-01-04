


import os
import shutil
import logging
from pathlib import Path

from .s3_service import (
    download_file_from_s3,
    upload_directory_to_s3,
    get_cloudfront_url
)
from ..processing.audio_features import extract_audio_features
from ..processing.embedding_utils import create_embedding_vector
from ..processing.hls_converter import convert_to_hls
from ..db.controllers import (
    ProcessingJobRepository,
    TrackRepository,
    AudioFeaturesRepository,
    TrackEmbeddingRepository,
    TrackEncryptionKeysRepository
)

logger = logging.getLogger(__name__)


def process_audio_file(job_id, s3_input_key, metadata, api_base_url):
    """
    Main audio processing pipeline.
    
    Args:
        job_id: Processing job ID
        s3_input_key: S3 key of uploaded audio file
        metadata: Dict with title, artist, genre, etc.
        api_base_url: Base API URL for key endpoint
        
    Returns:
        dict: {track_id, cdn_url}
    """
    temp_dir = f'/tmp/{job_id}'
    track_id = None
    
    try:
        ProcessingJobRepository.update_status(job_id, 'processing')
        logger.info(f"Starting processing for job {job_id}")
        
        os.makedirs(temp_dir, exist_ok=True)
        
        #  Download from S3
        filename = s3_input_key.split('/')[-1]
        local_audio_path = os.path.join(temp_dir, filename)
        download_file_from_s3(s3_input_key, local_audio_path)
        logger.info(f"Downloaded audio: {local_audio_path}")
        
        # Step 2: Extract audio features
        features = extract_audio_features(local_audio_path)
        if not features:
            raise ValueError("Failed to extract audio features")
        logger.info("Extracted audio features")
        
        # Create embedding vector
        embedding_vector = create_embedding_vector(features)
        logger.info(f"Created embedding vector: {len(embedding_vector)} dimensions")
        
        #  Create track in database (to get track_id)
        track_data = {
            'title': metadata.get('title', 'Unknown'),
            'artist_name': metadata.get('artist', 'Unknown Artist'),
            'album_title': metadata.get('album'),
            'genre_top': metadata.get('genre'),
            'listens': metadata.get('listens', 0),
            'interest': metadata.get('interest', 0),
            'processing_status': 'processing'
        }
        track_id = TrackRepository.create(track_data)
        logger.info(f"Created track {track_id}")
        
        # Generate encryption key
        TrackEncryptionKeysRepository.create(track_id=track_id)
        encryption_key = TrackEncryptionKeysRepository.get_key_bytes(track_id)
        logger.info(f"Generated encryption key for track {track_id}")
        
        # Convert to encrypted HLS
        hls_output_dir = os.path.join(temp_dir, 'hls')
        key_uri = f"{api_base_url}/api/keys/{track_id}"
        
        hls_result = convert_to_hls(
            input_path=local_audio_path,
            output_dir=hls_output_dir,
            track_id=track_id,
            encryption_key=encryption_key,
            key_uri=key_uri
        )
        logger.info(f"Converted to HLS with encryption")
        
        #  Upload HLS to S3
        hls_s3_prefix = f"audio/hls/{track_id}"
        track_hls_dir = os.path.join(hls_output_dir, str(track_id))
        upload_directory_to_s3(track_hls_dir, hls_s3_prefix)
        logger.info(f"Uploaded HLS to S3: {hls_s3_prefix}")
        
        # Get CDN URL
        cdn_url = get_cloudfront_url(f"{hls_s3_prefix}/master.m3u8")
        
        # Get audio duration
        duration_sec = features.get('duration', 0)
        
        # Update track with CDN URL and status
        TrackRepository.update(track_id, {
            'cdn_url': cdn_url,
            'duration_sec': duration_sec,
            'processing_status': 'completed'
        })
        
        #Insert audio features
        features['track_id'] = track_id
        AudioFeaturesRepository.create(features)
        logger.info(f"Saved audio features for track {track_id}")
        
        #  Insert embedding
        embedding_data = {
            'track_id': track_id,
            'embedding_vector': embedding_vector.tolist()
        }
        TrackEmbeddingRepository.create(embedding_data)
        logger.info(f"Saved embedding for track {track_id}")
        
        # Update job status
        ProcessingJobRepository.link_track(job_id, track_id)
        ProcessingJobRepository.update_status(job_id, 'completed')
        
        logger.info(f"Successfully processed job {job_id} -> track {track_id}")
        
        return {
            'track_id': track_id,
            'cdn_url': cdn_url
        }
        
    except Exception as e:
        logger.error(f"Error processing job {job_id}: {e}")
        
        # Update job status to failed
        error_message = str(e)
        ProcessingJobRepository.update_status(
            job_id, 
            'failed', 
            error_message=error_message
        )
        
        # If track was created, mark it as failed
        if track_id:
            TrackRepository.update(track_id, {'processing_status': 'failed'})
        
        raise
        
    finally:
        # Cleanup temp files
        if os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
                logger.info(f"Cleaned up temp directory: {temp_dir}")
            except Exception as e:
                logger.warning(f"Failed to cleanup temp dir: {e}")
