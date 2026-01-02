from datetime import datetime, UTC
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import Optional, List, Dict, Any
import uuid
import logging

from ..models.processing_jobs import ProcessingJob
from ..database import get_db_session

logger = logging.getLogger(__name__)


class ProcessingJobRepository:
    """Repository for processing job database operations"""
    
    @staticmethod
    def create(metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Create a new processing job.
        
        Args:
            metadata: Optional metadata for the job
            
        Returns:
            job_id (UUID string) if successful
            
        Raises:
            SQLAlchemyError: For database errors
        """
        try:
            with get_db_session() as session:
                job = ProcessingJob(
                    status='pending_upload',
                    started_at=datetime.now(UTC)
                )
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
        """
        Get processing job by job_id (UUID).
        
        Args:
            job_id: Job UUID string
            
        Returns:
            ProcessingJob object if found, None otherwise
        """
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
        """
        Update job status.
        
        Args:
            job_id: Job UUID string
            status: New status (pending_upload, uploaded, processing, completed, failed)
            error_message: Optional error message if failed
            
        Returns:
            True if updated, False if job not found
        """
        try:
            with get_db_session() as session:
                job = session.query(ProcessingJob).filter(
                    ProcessingJob.job_id == uuid.UUID(job_id)
                ).first()
                
                if not job:
                    logger.warning(f"Job {job_id} not found for status update")
                    return False
                
                job.status = status
                job.updated_at = datetime.now(UTC)
                
                if error_message:
                    job.error_message = error_message
                
                if status == 'completed':
                    job.completed_at = datetime.now(UTC)
                
                logger.info(f"Updated job {job_id} status to {status}")
                return True
        except ValueError:
            logger.error(f"Invalid UUID format: {job_id}")
            return False
        except SQLAlchemyError as e:
            logger.error(f"Error updating job {job_id}: {e}")
            raise
    
    @staticmethod
    def update_s3_key(job_id: str, s3_key: str) -> bool:
        """
        Update S3 input key after upload.
        
        Args:
            job_id: Job UUID string
            s3_key: S3 key of uploaded file
            
        Returns:
            True if updated, False if job not found
        """
        try:
            with get_db_session() as session:
                job = session.query(ProcessingJob).filter(
                    ProcessingJob.job_id == uuid.UUID(job_id)
                ).first()
                
                if not job:
                    logger.warning(f"Job {job_id} not found for S3 key update")
                    return False
                
                job.s3_input_key = s3_key
                job.status = 'uploaded'
                job.updated_at = datetime.now(UTC)
                
                logger.info(f"Updated job {job_id} with S3 key: {s3_key}")
                return True
        except ValueError:
            logger.error(f"Invalid UUID format: {job_id}")
            return False
        except SQLAlchemyError as e:
            logger.error(f"Error updating S3 key for job {job_id}: {e}")
            raise
    
    @staticmethod
    def link_track(job_id: str, track_id: int) -> bool:
        """
        Link job to created track.
        
        Args:
            job_id: Job UUID string
            track_id: Created track ID
            
        Returns:
            True if linked, False if job not found
        """
        try:
            with get_db_session() as session:
                job = session.query(ProcessingJob).filter(
                    ProcessingJob.job_id == uuid.UUID(job_id)
                ).first()
                
                if not job:
                    logger.warning(f"Job {job_id} not found for track linking")
                    return False
                
                job.track_id = track_id
                job.updated_at = datetime.now(UTC)
                
                logger.info(f"Linked job {job_id} to track {track_id}")
                return True
        except ValueError:
            logger.error(f"Invalid UUID format: {job_id}")
            return False
        except SQLAlchemyError as e:
            logger.error(f"Error linking track to job {job_id}: {e}")
            raise
    
    @staticmethod
    def get_pending_jobs(limit: int = 100) -> List[ProcessingJob]:
        """
        Get all pending jobs (uploaded status).
        
        Args:
            limit: Maximum number of jobs to return
            
        Returns:
            List of ProcessingJob objects
        """
        try:
            with get_db_session() as session:
                jobs = session.query(ProcessingJob).filter(
                    ProcessingJob.status == 'uploaded'
                ).order_by(ProcessingJob.created_at).limit(limit).all()
                
                for job in jobs:
                    session.expunge(job)
                
                return jobs
        except SQLAlchemyError as e:
            logger.error(f"Error fetching pending jobs: {e}")
            raise
    
    @staticmethod
    def get_failed_jobs(limit: int = 100) -> List[ProcessingJob]:
        """
        Get all failed jobs.
        
        Args:
            limit: Maximum number of jobs to return
            
        Returns:
            List of ProcessingJob objects
        """
        try:
            with get_db_session() as session:
                jobs = session.query(ProcessingJob).filter(
                    ProcessingJob.status == 'failed'
                ).order_by(ProcessingJob.updated_at.desc()).limit(limit).all()
                
                for job in jobs:
                    session.expunge(job)
                
                return jobs
        except SQLAlchemyError as e:
            logger.error(f"Error fetching failed jobs: {e}")
            raise
    
    @staticmethod
    def delete(job_id: str) -> bool:
        """
        Delete a processing job.
        
        Args:
            job_id: Job UUID string
            
        Returns:
            True if deleted, False if job not found
        """
        try:
            with get_db_session() as session:
                job = session.query(ProcessingJob).filter(
                    ProcessingJob.job_id == uuid.UUID(job_id)
                ).first()
                
                if not job:
                    logger.warning(f"Job {job_id} not found for deletion")
                    return False
                
                session.delete(job)
                logger.info(f"Deleted job {job_id}")
                return True
        except ValueError:
            logger.error(f"Invalid UUID format: {job_id}")
            return False
        except SQLAlchemyError as e:
            logger.error(f"Error deleting job {job_id}: {e}")
            raise
