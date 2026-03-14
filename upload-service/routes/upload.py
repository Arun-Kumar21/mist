from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import logging
import os
from slowapi import Limiter
from slowapi.util import get_remote_address

from shared.db.controllers import ProcessingJobRepository
from services.s3_service import generate_presigned_upload_url
from shared.util.auth_dependencies import verify_token

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/upload", tags=["Upload"])


def _require_auth(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = auth_header.split(" ", 1)[1]
    token_data = verify_token(token)
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return token_data


class UploadRequest(BaseModel):
    filename: str
    filesize: int
    contentType: str
    metadata: Optional[dict] = {}


class UploadComplete(BaseModel):
    jobId: str
    metadata: dict


@router.post('/request')
@limiter.limit("5/minute")
async def file_upload_request(request: Request, upload_req: UploadRequest):
    _require_auth(request)
    try:
        job_id = ProcessingJobRepository.create(metadata=upload_req.metadata)
        presigned_data = generate_presigned_upload_url(
            filename=upload_req.filename,
            content_type=upload_req.contentType,
            job_id=job_id,
            expires_in=900
        )
        ProcessingJobRepository.update_s3_key(job_id, presigned_data['s3_key'])
        return {
            "success": True,
            "jobId": job_id,
            "uploadUrl": presigned_data['url'],
            "fields": presigned_data['fields'],
            "s3Key": presigned_data['s3_key'],
            "expiresIn": 900,
        }
    except Exception as e:
        logger.error(f"Error creating upload request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/complete')
@limiter.limit("5/minute")
async def file_upload_complete(request: Request, req: UploadComplete):
    _require_auth(request)
    try:
        job = ProcessingJobRepository.get_by_job_id(req.jobId)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if not job.s3_input_key:
            raise HTTPException(status_code=400, detail="S3 key not found for job")

        ProcessingJobRepository.update_status(req.jobId, status='uploaded')

        from celery_app import celery_app
        task = celery_app.send_task('tasks.process_audio', args=[req.jobId, req.metadata])

        return {
            'success': True,
            'jobId': str(job.job_id),
            'taskId': task.id,
            'status': 'uploaded',
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/job/{job_id}')
async def get_job_status(job_id: str, request: Request):
    _require_auth(request)
    try:
        job = ProcessingJobRepository.get_by_job_id(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        response = {
            'jobId': str(job.job_id),
            'status': job.status,
            'createdAt': job.created_at.isoformat() if job.created_at else None,
            'completedAt': job.completed_at.isoformat() if job.completed_at else None,
        }

        if job.status == 'completed' and job.track_id:
            try:
                from shared.db.controllers import TrackRepository
                track = TrackRepository.get_by_id(job.track_id)
                if track:
                    response['track'] = track.to_dict()
            except Exception as e:
                logger.error(f"Error fetching track info: {e}")

        if job.status == 'failed' and job.error_message:
            response['error'] = job.error_message

        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
