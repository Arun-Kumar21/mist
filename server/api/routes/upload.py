from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import logging
from typing import Optional
import sys
from pathlib import Path
from slowapi import Limiter
from slowapi.util import get_remote_address

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from db.controllers import ProcessingJobRepository
from services.s3_service import generate_presigned_upload_url


logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(
    prefix="/upload",
    tags=["Upload"]
)


class UploadRequest(BaseModel):
    filename: str
    filesize: int
    contentType: str
    metadata: Optional[dict] = {}


@router.post('/request')
@limiter.limit("5/minute")
async def fileUploadRequest(request: Request, upload_req: UploadRequest):

    try:
        # Create processing job
        job_id = ProcessingJobRepository.create(metadata=upload_req.metadata)
        logger.info(f"Created job {job_id} for file: {upload_req.filename}")

        # Generate presigned S3 upload Url
        presigned_data = generate_presigned_upload_url(
            filename=upload_req.filename,
            content_type=upload_req.contentType,
            job_id=job_id,
            expires_in=900 # 15 min
        )

        # Store S3 key in job
        ProcessingJobRepository.update_s3_key(job_id, presigned_data['s3_key'])

        return {
            "success": True,
            "jobId": job_id,
            "uploadUrl": presigned_data['url'],
            "fields": presigned_data['fields'],
            "s3Key": presigned_data['s3_key'],
            "expiresIn": 900,
            "message": "Upload file to provided URL"
        }

    except Exception as e:
        logger.error(f"Error creating upload request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class UploadComplete(BaseModel): 
    jobId: str 
    metadata: dict


@router.post('/complete')
@limiter.limit("5/minute")
async def fileUploadComplete(request: Request, req: UploadComplete):
    """
    Notify server that upload is complete
    Triggers async audio processing via Celery
    """
    try:
        # Verify job exists
        job = ProcessingJobRepository.get_by_job_id(req.jobId)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if not job.s3_input_key:
            raise HTTPException(status_code=400, detail="S3 key not found for job")
        
        # Update status to uploaded
        ProcessingJobRepository.update_status(req.jobId, status='uploaded')
        
        # Queue the processing task using send_task to avoid circular import
        from celery_app import celery_app
        task = celery_app.send_task(
            'tasks.process_audio',
            args=[req.jobId, req.metadata]
        )
        
        logger.info(f"Queued processing task {task.id} for job {req.jobId}")
        
        return {
            'success': True,
            'jobId': str(job.job_id),
            'taskId': task.id,  # Celery task ID 
            'status': 'uploaded',
            'message': 'Processing started in background'
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in upload complete: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/job/{job_id}')
async def get_job_status(job_id: str):
    """
    Check processing job status
    
    Returns:
        - pending_upload: Waiting for file upload
        - uploaded: File uploaded, waiting to process
        - processing: Currently processing
        - completed: Done! Track ready
        - failed: Error occurred
    """
    try:
        job = ProcessingJobRepository.get_by_job_id(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        response = {
            'jobId': str(job.job_id),
            'status': job.status,
            'createdAt': job.created_at.isoformat() if job.created_at else None,
            'startedAt': job.started_at.isoformat() if job.started_at else None,
            'completedAt': job.completed_at.isoformat() if job.completed_at else None
        }
        
        # If completed, include track info
        if job.status == 'completed' and job.track_id:
            try:
                from db.controllers import TrackRepository
                track = TrackRepository.get_by_id(job.track_id)
                if track:
                    response['track'] = track.to_dict()
            except Exception as track_error:
                logger.error(f"Error fetching track info: {track_error}")
                response['track'] = {'track_id': job.track_id, 'error': 'Could not load track details'}
        
        # If failed, include error
        if job.status == 'failed' and job.error_message:
            response['error'] = job.error_message
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching job status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
