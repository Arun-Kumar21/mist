from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging
from typing import Optional
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from db.controllers import ProcessingJobRepository
from services.s3_service import generate_presigned_upload_url


logger = logging.getLogger(__name__)

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
async def fileUploadRequest(request: UploadRequest):

    try:
        # Create processing job
        job_id = ProcessingJobRepository.create(metadata=request.metadata)
        logger.info(f"Created job {job_id} for file: {request.filename}")

        # Generate presigned S3 upload Url
        presigned_data = generate_presigned_upload_url(
            filename=request.filename,
            content_type=request.contentType,
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


@router.post('/complete')
async def fileUploadComplete(req: UploadComplete):
    """
    Notify server that upload is complete
    Triggers async audio processing
    """
    try:
        # Get job to verify it exists
        job = ProcessingJobRepository.get_by_job_id(req.jobId)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if not job.s3_input_key:
            raise HTTPException(status_code=400, detail="S3 key not found for job")
        
        # Update status to uploaded (ready for processing)
        ProcessingJobRepository.update_status(req.jobId, status='uploaded')
        
        # TODO: Trigger Celery task for async processing
        # from tasks.audio_processing import process_audio_task
        # process_audio_task.delay(req.jobId)
        
        logger.info(f"Job {req.jobId} marked as uploaded, ready for processing")
        
        return {
            'success': True,
            'jobId': str(job.job_id),
            'status': 'uploaded',
            'message': 'Upload complete, processing will begin shortly'
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in upload complete: {e}")
        raise HTTPException(status_code=500, detail=str(e))
