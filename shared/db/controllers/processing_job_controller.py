from datetime import datetime, UTC
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional, List, Dict, Any
import uuid
import logging

from shared.db.models.processing_jobs import ProcessingJob
from shared.db.database import get_db_session

logger = logging.getLogger(__name__)


class ProcessingJobRepository:

    @staticmethod
    def create(metadata: Optional[Dict[str, Any]] = None) -> str:
        try:
            with get_db_session() as session:
                job = ProcessingJob(status='pending_upload', started_at=datetime.now(UTC))
                session.add(job)
                session.flush()
                job_id = str(job.job_id)
                logger.info(f"Created processing job {job_id}")
                return job_id
        except SQLAlchemyError as e:
            logger.error(f"Error creating processing job: {e}")
            raise

    @staticmethod
    def get_by_job_id(job_id: str) -> Optional[ProcessingJob]:
        try:
            with get_db_session() as session:
                job = session.query(ProcessingJob).filter(
                    ProcessingJob.job_id == uuid.UUID(job_id)
                ).first()
                if job:
                    session.expunge(job)
                return job
        except ValueError:
            logger.error(f"Invalid UUID format: {job_id}")
            return None
        except SQLAlchemyError as e:
            logger.error(f"Error fetching job {job_id}: {e}")
            raise

    @staticmethod
    def update_status(job_id: str, status: str, error_message: Optional[str] = None) -> bool:
        try:
            with get_db_session() as session:
                job = session.query(ProcessingJob).filter(
                    ProcessingJob.job_id == uuid.UUID(job_id)
                ).first()
                if not job:
                    return False
                job.status = status
                job.updated_at = datetime.now(UTC)
                if error_message:
                    job.error_message = error_message
                if status == 'completed':
                    job.completed_at = datetime.now(UTC)
                return True
        except ValueError:
            logger.error(f"Invalid UUID format: {job_id}")
            return False
        except SQLAlchemyError as e:
            logger.error(f"Error updating job {job_id}: {e}")
            raise

    @staticmethod
    def update_s3_key(job_id: str, s3_key: str) -> bool:
        try:
            with get_db_session() as session:
                job = session.query(ProcessingJob).filter(
                    ProcessingJob.job_id == uuid.UUID(job_id)
                ).first()
                if not job:
                    return False
                job.s3_input_key = s3_key
                job.status = 'uploaded'
                job.updated_at = datetime.now(UTC)
                return True
        except ValueError:
            logger.error(f"Invalid UUID format: {job_id}")
            return False
        except SQLAlchemyError as e:
            logger.error(f"Error updating S3 key for job {job_id}: {e}")
            raise

    @staticmethod
    def link_track(job_id: str, track_id: int) -> bool:
        try:
            with get_db_session() as session:
                job = session.query(ProcessingJob).filter(
                    ProcessingJob.job_id == uuid.UUID(job_id)
                ).first()
                if not job:
                    return False
                job.track_id = track_id
                job.updated_at = datetime.now(UTC)
                return True
        except ValueError:
            logger.error(f"Invalid UUID format: {job_id}")
            return False
        except SQLAlchemyError as e:
            logger.error(f"Error linking track to job {job_id}: {e}")
            raise
