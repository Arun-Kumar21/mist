from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse
import sys
from pathlib import Path
import logging
import boto3
import os

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from db.controllers import TrackRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/proxy", tags=["Proxy"])

S3_BUCKET = os.getenv('S3_BUCKET_NAME', 'mist-music-cdn')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')

s3_client = boto3.client('s3', region_name=AWS_REGION)


@router.get("/{track_id}/{path:path}")
async def proxy_hls_file(track_id: int, path: str):
    """
    DEV ONLY: Proxy HLS files from S3 to bypass CORS during local testing.
    """
    try:
        logger.info(f"[PROXY] Requested: track_id={track_id}, path={path}")
        
        # Verify track exists
        track = TrackRepository.get_by_id(track_id)
        if not track:
            logger.error(f"[PROXY] Track {track_id} not found")
            raise HTTPException(status_code=404, detail="Track not found")
        
        # Construct S3 key
        s3_key = f"audio/hls/{track_id}/{path}"
        logger.info(f"[PROXY] Fetching from S3: {S3_BUCKET}/{s3_key}")
        
        try:
            # Get file from S3
            response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
            content = response['Body'].read()
            logger.info(f"[PROXY] Successfully fetched {len(content)} bytes")
            
        except s3_client.exceptions.NoSuchKey:
            logger.error(f"[PROXY] S3 file not found: {s3_key}")
            raise HTTPException(status_code=404, detail=f"File not found: {path}")
        
        # Determine content type
        if path.endswith('.m3u8'):
            content_type = 'application/vnd.apple.mpegurl'
            
            # Modify playlist URLs to point back to proxy
            content_str = content.decode('utf-8')
            logger.info(f"[PROXY] Original playlist content:\n{content_str[:500]}")
            
            # Replace key URI in playlist
            if 'EXT-X-KEY' in content_str:
                import re
                content_str = re.sub(
                    r'URI="[^"]*"',
                    f'URI="http://localhost:8000/api/v1/keys/{track_id}"',
                    content_str
                )
                logger.info("[PROXY] Updated key URI")
            
            # Replace relative paths in master playlist (e.g., "64k/playlist.m3u8")
            if 'master.m3u8' in path:
                import re
                lines = content_str.split('\n')
                new_lines = []
                for line in lines:
                    if line.endswith('/playlist.m3u8'):
                        # Convert "64k/playlist.m3u8" to full proxy URL
                        new_line = f"http://localhost:8000/api/v1/proxy/{track_id}/{line}"
                        new_lines.append(new_line)
                        logger.info(f"[PROXY] Rewrite: {line} -> {new_line}")
                    else:
                        new_lines.append(line)
                content_str = '\n'.join(new_lines)
            
            # Replace segment paths in variant playlists (e.g., "segment_001.ts")
            elif '/playlist.m3u8' in path:
                import re
                lines = content_str.split('\n')
                new_lines = []
                bitrate_dir = path.rsplit('/', 1)[0]  # e.g., "64k"
                
                for line in lines:
                    if line.endswith('.ts'):
                        # Convert "segment_001.ts" to full proxy URL
                        new_line = f"http://localhost:8000/api/v1/proxy/{track_id}/{bitrate_dir}/{line}"
                        new_lines.append(new_line)
                        logger.info(f"[PROXY] Rewrite segment: {line} -> {new_line}")
                    else:
                        new_lines.append(line)
                content_str = '\n'.join(new_lines)
            
            content = content_str.encode('utf-8')
            logger.info(f"[PROXY] Modified playlist content:\n{content.decode()[:500]}")
            
        elif path.endswith('.ts'):
            content_type = 'video/mp2t'
            logger.info(f"[PROXY] Serving TS segment: {path}")
        else:
            content_type = 'application/octet-stream'
        
        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Expose-Headers": "*",
                "Cache-Control": "public, max-age=31536000" if path.endswith('.ts') else "public, max-age=60"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[PROXY] Unexpected error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
