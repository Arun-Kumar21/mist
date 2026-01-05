from celery_app import celery_app
from services.audio_processing_service import process_audio_file
from db.controllers import ProcessingJobRepository
import logging
import os

logger = logging.getLogger(__name__)

API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000')


@celery_app.task(name='tasks.process_audio', bind=True)
def process_audio_task(self, job_id: str, metadata):
    """
    Background task to process uploaded audio file
    
    Args:
        self: Celery task instance (for retry/status)
        job_id: Processing job UUID
        
    Returns:
        dict: Processing result with track_id and cdn_url
    """
    try:
        logger.info(f"[CELERY] Starting audio processing for job {job_id}")
        
        # Update status to processing
        ProcessingJobRepository.update_status(job_id, 'processing')
        
        # Get job details
        job = ProcessingJobRepository.get_by_job_id(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")
        
        if not job.s3_input_key:
            raise ValueError(f"No S3 key found for job {job_id}")
        
        # Process the audio file
        result = process_audio_file(
            job_id=job_id,
            s3_input_key=job.s3_input_key,
            metadata=metadata or {},
            api_base_url=API_BASE_URL
        )
        
        logger.info(f"[CELERY] Successfully processed job {job_id}")
        logger.info(f"[CELERY] Result: track_id={result['track_id']}, cdn_url={result['cdn_url']}")
        
        return result
        
    except Exception as e:
        logger.error(f"[CELERY] Error processing job {job_id}: {e}")
        
        # Update job status to failed
        try:
            ProcessingJobRepository.update_status(
                job_id, 
                'failed', 
                error_message=str(e)
            )
        except Exception as db_error:
            logger.error(f"[CELERY] Failed to update job status: {db_error}")
        
        # Retry task up to 3 times with exponential backoff
        raise self.retry(exc=e, countdown=60, max_retries=3)


@celery_app.task(name='tasks.cleanup_temp_files')
def cleanup_temp_files_task(job_id: str):
    """Background task to cleanup temporary files after processing"""
    import shutil
    temp_dir = f'/tmp/{job_id}'
    try:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
            logger.info(f"[CELERY] Cleaned up temp directory: {temp_dir}")
    except Exception as e:
        logger.error(f"[CELERY] Error cleaning up temp files: {e}")
