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


def generate_hls_stream_url(track_id: int) -> str:
    s3_key = f"audio/hls/{track_id}/master.m3u8"
    return f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"


def delete_track_files(track_id: int):
    try:
        s3_client = _get_s3_client()
        prefix = f"audio/hls/{track_id}/"
        response = s3_client.list_objects_v2(Bucket=S3_BUCKET_NAME, Prefix=prefix)
        objects = response.get('Contents', [])
        if objects:
            s3_client.delete_objects(
                Bucket=S3_BUCKET_NAME,
                Delete={'Objects': [{'Key': obj['Key']} for obj in objects]}
            )
            logger.info(f"Deleted {len(objects)} S3 files for track {track_id}")
    except ClientError as e:
        logger.error(f"Error deleting S3 files for track {track_id}: {e}")
        raise


def generate_presigned_read_url(s3_key: str, expires_in: int = 3600) -> str:
    """Generate a temporary signed URL for reading an S3 object."""
    try:
        s3_client = _get_s3_client()
        return s3_client.generate_presigned_url(
            ClientMethod='get_object',
            Params={'Bucket': S3_BUCKET_NAME, 'Key': s3_key},
            ExpiresIn=expires_in,
        )
    except ClientError as e:
        logger.error(f"Error generating presigned read URL for {s3_key}: {e}")
        raise


def upload_banner_image(file_bytes: bytes, s3_key: str, content_type: str) -> str:
    """Upload banner image bytes to S3 and return the public URL."""
    try:
        s3_client = _get_s3_client()
        try:
            s3_client.put_object(
                Bucket=S3_BUCKET_NAME,
                Key=s3_key,
                Body=file_bytes,
                ContentType=content_type,
                ACL='public-read',
                CacheControl='public, max-age=86400',
            )
        except ClientError as acl_error:
            error_code = acl_error.response.get('Error', {}).get('Code')
            if error_code == 'AccessControlListNotSupported':
                logger.warning(
                    "Bucket has ACLs disabled; retrying banner upload without ACL. "
                    "Ensure bucket policy allows public s3:GetObject for banners/*"
                )
                s3_client.put_object(
                    Bucket=S3_BUCKET_NAME,
                    Key=s3_key,
                    Body=file_bytes,
                    ContentType=content_type,
                    CacheControl='public, max-age=86400',
                )
            else:
                raise
        url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
        logger.info(f"Uploaded banner image to {s3_key}")
        return url
    except ClientError as e:
        logger.error(f"Error uploading banner image to {s3_key}: {e}")
        raise


def delete_banner_image(image_key: str):
    """Delete a banner image from S3 by its key."""
    try:
        s3_client = _get_s3_client()
        s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=image_key)
        logger.info(f"Deleted banner image {image_key}")
    except ClientError as e:
        logger.error(f"Error deleting banner image {image_key}: {e}")
        raise


def upload_track_cover_image(file_bytes: bytes, s3_key: str, content_type: str) -> str:
    """Upload track cover image bytes to S3 and return the URL."""
    try:
        s3_client = _get_s3_client()
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type,
            CacheControl='public, max-age=86400',
        )
        url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
        logger.info(f"Uploaded track cover image to {s3_key}")
        return url
    except ClientError as e:
        logger.error(f"Error uploading track cover image to {s3_key}: {e}")
        raise


def delete_track_cover_image(image_key: str):
    """Delete track cover image from S3 by key."""
    try:
        s3_client = _get_s3_client()
        s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=image_key)
        logger.info(f"Deleted track cover image {image_key}")
    except ClientError as e:
        logger.error(f"Error deleting track cover image {image_key}: {e}")
        raise
