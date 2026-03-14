import boto3
import os
import logging
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME')

if not S3_BUCKET_NAME:
    raise ValueError("S3_BUCKET_NAME not set")


def _get_s3_client():
    return boto3.client(
        's3',
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_REGION
    )


def generate_presigned_upload_url(filename: str, content_type: str, job_id: str, expires_in: int = 900) -> dict:
    try:
        s3_client = _get_s3_client()
        s3_key = f"audio/original/{job_id}/{filename}"
        response = s3_client.generate_presigned_post(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            Fields={'Content-Type': content_type},
            Conditions=[
                {'Content-Type': content_type},
                ['content-length-range', 1, 52428800],
            ],
            ExpiresIn=expires_in
        )
        return {'url': response['url'], 'fields': response['fields'], 's3_key': s3_key}
    except ClientError as e:
        logger.error(f"Error generating presigned URL: {e}")
        raise
