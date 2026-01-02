import boto3
import os
import logging
from pathlib import Path
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# AWS Configuration
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME')
CLOUDFRONT_DOMAIN = os.getenv('CLOUDFRONT_DOMAIN', '')

if not S3_BUCKET_NAME:
    raise ValueError("S3_BUCKET_NAME not set in environment variables")


def _get_s3_client():
    """Get configured S3 client"""
    return boto3.client(
        's3',
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_REGION
    )


def generate_presigned_upload_url(filename, content_type, job_id, expires_in=900):
    """
    Generate presigned POST URL for direct upload to S3.
    
    Args:
        filename: Original filename
        content_type: MIME type (e.g., 'audio/mpeg')
        job_id: Unique job identifier
        expires_in: URL expiration in seconds (default 15 minutes)
    
    Returns:
        dict: {url, fields, s3_key} for upload
    """
    try:
        s3_client = _get_s3_client()
        
        # Construct S3 key with job_id prefix
        s3_key = f"audio/original/{job_id}/{filename}"
        
        # Generate presigned POST
        response = s3_client.generate_presigned_post(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            Fields={'Content-Type': content_type},
            Conditions=[
                {'Content-Type': content_type},
                ['content-length-range', 1, 52428800]  # 1 byte to 50MB
            ],
            ExpiresIn=expires_in
        )
        
        logger.info(f"Generated presigned URL for {s3_key}")
        
        return {
            'url': response['url'],
            'fields': response['fields'],
            's3_key': s3_key
        }
        
    except ClientError as e:
        logger.error(f"Error generating presigned URL: {e}")
        raise


def upload_directory_to_s3(local_dir, s3_prefix):
    """
    Upload entire directory to S3, preserving structure.
    
    Args:
        local_dir: Local directory path
        s3_prefix: S3 prefix (e.g., 'audio/hls/12345')
    
    Returns:
        list: S3 keys of uploaded files
    """
    try:
        s3_client = _get_s3_client()
        uploaded_keys = []
        
        local_path = Path(local_dir)
        
        for file_path in local_path.rglob('*'):
            if file_path.is_file():
                relative_path = file_path.relative_to(local_path)
                s3_key = f"{s3_prefix}/{relative_path}".replace('\\', '/')
                
                content_type = _get_content_type(file_path.suffix)
                
                # Upload file
                s3_client.upload_file(
                    str(file_path),
                    S3_BUCKET_NAME,
                    s3_key,
                    ExtraArgs={'ContentType': content_type}
                )
                
                uploaded_keys.append(s3_key)
                logger.info(f"Uploaded: {s3_key}")
        
        logger.info(f"Uploaded {len(uploaded_keys)} files to {s3_prefix}")
        return uploaded_keys
        
    except ClientError as e:
        logger.error(f"Error uploading directory to S3: {e}")
        raise


def download_file_from_s3(s3_key, local_path):
    """
    Download file from S3 to local path.
    
    Args:
        s3_key: S3 object key
        local_path: Local destination path
    
    Returns:
        str: Local file path
    """
    try:
        s3_client = _get_s3_client()
        
        Path(local_path).parent.mkdir(parents=True, exist_ok=True)
        
        s3_client.download_file(S3_BUCKET_NAME, s3_key, local_path)
        logger.info(f"Downloaded {s3_key} to {local_path}")
        
        return local_path
        
    except ClientError as e:
        logger.error(f"Error downloading from S3: {e}")
        raise


def delete_track_files(track_id):
    """
    Delete all S3 files for a track (original + HLS).
    
    Args:
        track_id: Track identifier
    
    Returns:
        int: Number of objects deleted
    """
    try:
        s3_client = _get_s3_client()
        

        prefixes = [
            f"audio/original/{track_id}/",
            f"audio/hls/{track_id}/"
        ]
        
        deleted_count = 0
        
        for prefix in prefixes:
            # List objects
            response = s3_client.list_objects_v2(
                Bucket=S3_BUCKET_NAME,
                Prefix=prefix
            )
            
            if 'Contents' in response:
                # Delete objects
                objects = [{'Key': obj['Key']} for obj in response['Contents']]
                
                if objects:
                    s3_client.delete_objects(
                        Bucket=S3_BUCKET_NAME,
                        Delete={'Objects': objects}
                    )
                    deleted_count += len(objects)
                    logger.info(f"Deleted {len(objects)} objects from {prefix}")
        
        logger.info(f"Total deleted: {deleted_count} objects for track {track_id}")
        return deleted_count
        
    except ClientError as e:
        logger.error(f"Error deleting track files: {e}")
        raise


def get_cloudfront_url(s3_key):
    """
    Convert S3 key to CloudFront URL.
    
    Args:
        s3_key: S3 object key
    
    Returns:
        str: CloudFront URL
    """
    if CLOUDFRONT_DOMAIN:
        return f"https://{CLOUDFRONT_DOMAIN}/{s3_key}"
    else:
        # Fallback to S3 direct URL
        return f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"


def _get_content_type(file_extension):
    """Get content type based on file extension"""
    content_types = {
        '.m3u8': 'application/x-mpegURL',
        '.ts': 'video/MP2T',
        '.mp3': 'audio/mpeg',
        '.mp4': 'video/mp4',
        '.wav': 'audio/wav',
        '.flac': 'audio/flac',
        '.key': 'application/octet-stream'
    }
    return content_types.get(file_extension.lower(), 'application/octet-stream')

