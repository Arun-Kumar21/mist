"""
Setup script for configuring S3 bucket CORS and permissions.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from services.s3_service import configure_bucket_cors
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    """Configure S3 bucket for direct HLS streaming"""
    logger.info("Configuring S3 bucket CORS for HLS streaming...")
    
    try:
        configure_bucket_cors()
        logger.info("SUCCESS: S3 CORS configuration successful!")
        logger.info("Your S3 bucket is now configured for direct streaming.")
        logger.info("This eliminates the need for proxy and significantly improves streaming speed.")
        
    except Exception as e:
        logger.error(f"FAILED: Failed to configure S3 CORS: {e}")
        logger.error("Make sure your AWS credentials have s3:PutBucketCors permission.")
        sys.exit(1)


if __name__ == "__main__":
    main()
