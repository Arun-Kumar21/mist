from celery_app import celery_app
from services.audio_processing_service import process_audio_file
from shared.db.controllers import ProcessingJobRepository
import logging
import os
import shutil

logger = logging.getLogger(__name__)

API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000')


@celery_app.task(name='tasks.process_audio', bind=True)
def process_audio_task(self, job_id: str, metadata):
    try:
        logger.info(f"[TASK] Starting audio processing for job {job_id}")
        ProcessingJobRepository.update_status(job_id, 'processing')

        job = ProcessingJobRepository.get_by_job_id(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")
        if not job.s3_input_key:
            raise ValueError(f"No S3 key found for job {job_id}")

        result = process_audio_file(
            job_id=job_id,
            s3_input_key=job.s3_input_key,
            metadata=metadata or {},
            api_base_url=API_BASE_URL
        )

        logger.info(f"[TASK] Completed job {job_id} -> track {result['track_id']}")
        return result

    except Exception as e:
        logger.error(f"[TASK] Error processing job {job_id}: {e}")
        try:
            ProcessingJobRepository.update_status(job_id, 'failed', error_message=str(e))
        except Exception as db_error:
            logger.error(f"[TASK] Failed to update job status: {db_error}")
        raise self.retry(exc=e, countdown=60, max_retries=3)


@celery_app.task(name='tasks.cleanup_temp_files')
def cleanup_temp_files_task(job_id: str):
    temp_dir = f'/tmp/{job_id}'
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
        logger.info(f"Cleaned up temp dir: {temp_dir}")
