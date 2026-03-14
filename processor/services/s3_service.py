import boto3
import os
import logging
from pathlib import Path
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


def download_file_from_s3(s3_key: str, local_path: str):
    try:
        s3_client = _get_s3_client()
        s3_client.download_file(S3_BUCKET_NAME, s3_key, local_path)
        logger.info(f"Downloaded {s3_key} to {local_path}")
    except ClientError as e:
        logger.error(f"Error downloading {s3_key}: {e}")
        raise


def upload_directory_to_s3(local_dir: str, s3_prefix: str):
    try:
        s3_client = _get_s3_client()
        local_path = Path(local_dir)
        uploaded = []
        for file_path in local_path.rglob('*'):
            if file_path.is_file():
                relative_path = file_path.relative_to(local_path)
                s3_key = f"{s3_prefix}/{relative_path}".replace('\\', '/')
                content_type = _get_content_type(file_path.suffix)
                s3_client.upload_file(
                    str(file_path), S3_BUCKET_NAME, s3_key,
                    ExtraArgs={'ContentType': content_type, 'ACL': 'public-read'}
                )
                uploaded.append(s3_key)
        logger.info(f"Uploaded {len(uploaded)} files to {s3_prefix}")
        return uploaded
    except ClientError as e:
        logger.error(f"Error uploading directory to S3: {e}")
        raise


def _get_content_type(extension: str) -> str:
    types = {
        '.m3u8': 'application/vnd.apple.mpegurl',
        '.ts': 'video/mp2t',
        '.key': 'application/octet-stream',
        '.mp3': 'audio/mpeg',
        '.mp4': 'audio/mp4',
        '.aac': 'audio/aac',
        '.flac': 'audio/flac',
    }
    return types.get(extension.lower(), 'application/octet-stream')
