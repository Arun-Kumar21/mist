import uuid
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel

from shared.db.controllers.banner_controller import BannerRepository
from services.s3_service import upload_banner_image, delete_banner_image, generate_presigned_read_url
from middleware import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/banners", tags=["Banners"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/avif"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


def _serialize_banner(banner):
    data = banner.to_dict()
    if banner.image_key:
        try:
            data["image_url"] = generate_presigned_read_url(banner.image_key)
        except Exception as e:
            logger.warning(f"Could not generate signed URL for banner {banner.banner_id}: {e}")
    return data


@router.get("")
async def get_active_banners():
    """Return all active banners ordered by display_order. Public endpoint."""
    try:
        banners = BannerRepository.get_active()
        return {"success": True, "count": len(banners), "banners": [_serialize_banner(b) for b in banners]}
    except Exception as e:
        logger.error(f"Error fetching banners: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all")
@require_admin
async def get_all_banners(request: Request):
    """Return all banners (active + inactive). Admin only."""
    try:
        banners = BannerRepository.get_all()
        return {"success": True, "count": len(banners), "banners": [_serialize_banner(b) for b in banners]}
    except Exception as e:
        logger.error(f"Error fetching all banners: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
@require_admin
async def create_banner(
    request: Request,
    image: UploadFile = File(...),
    title: Optional[str] = Form(default=None),
    subtitle: Optional[str] = Form(default=None),
    link_url: Optional[str] = Form(default=None),
    display_order: int = Form(default=0),
    is_active: bool = Form(default=True),
):
    """Upload a banner image to S3 and create the DB record. Admin only."""
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type. Use JPEG, PNG, WebP, or AVIF.")

    file_bytes = await image.read()
    if len(file_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image exceeds 10 MB limit.")

    ext = image.filename.rsplit(".", 1)[-1].lower() if image.filename and "." in image.filename else "jpg"
    image_key = f"banners/{uuid.uuid4()}/{uuid.uuid4()}.{ext}"

    try:
        image_url = upload_banner_image(file_bytes, image_key, image.content_type)
    except Exception as e:
        logger.error(f"S3 upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload image to storage.")

    try:
        banner_id = BannerRepository.create({
            "title": title,
            "subtitle": subtitle,
            "image_url": image_url,
            "image_key": image_key,
            "link_url": link_url,
            "display_order": display_order,
            "is_active": is_active,
        })
        banner = BannerRepository.get_by_id(banner_id)
        return {"success": True, "banner": _serialize_banner(banner)}
    except Exception as e:
        # Attempt S3 cleanup on DB failure
        try:
            delete_banner_image(image_key)
        except Exception:
            pass
        logger.error(f"Error creating banner record: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class UpdateBannerRequest(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    link_url: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


@router.put("/{banner_id}")
@require_admin
async def update_banner(banner_id: int, req: UpdateBannerRequest, request: Request):
    """Update banner metadata. Admin only."""
    try:
        if not BannerRepository.get_by_id(banner_id):
            raise HTTPException(status_code=404, detail="Banner not found")
        update_data = req.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        BannerRepository.update(banner_id, update_data)
        banner = BannerRepository.get_by_id(banner_id)
        return {"success": True, "banner": _serialize_banner(banner)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating banner {banner_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{banner_id}/image")
@require_admin
async def replace_banner_image(
    banner_id: int,
    request: Request,
    image: UploadFile = File(...),
):
    """Replace the image of an existing banner. Admin only."""
    existing = BannerRepository.get_by_id(banner_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Banner not found")

    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type. Use JPEG, PNG, WebP, or AVIF.")

    file_bytes = await image.read()
    if len(file_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image exceeds 10 MB limit.")

    ext = image.filename.rsplit(".", 1)[-1].lower() if image.filename and "." in image.filename else "jpg"
    new_key = f"banners/{uuid.uuid4()}/{uuid.uuid4()}.{ext}"

    try:
        new_url = upload_banner_image(file_bytes, new_key, image.content_type)
    except Exception as e:
        logger.error(f"S3 upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload image to storage.")

    old_key = existing.image_key
    BannerRepository.update(banner_id, {"image_url": new_url, "image_key": new_key})

    if old_key:
        try:
            delete_banner_image(old_key)
        except Exception as e:
            logger.warning(f"Could not delete old banner image {old_key}: {e}")

    banner = BannerRepository.get_by_id(banner_id)
    return {"success": True, "banner": _serialize_banner(banner)}


@router.delete("/{banner_id}")
@require_admin
async def delete_banner(banner_id: int, request: Request):
    """Delete banner record and its S3 image. Admin only."""
    try:
        if not BannerRepository.get_by_id(banner_id):
            raise HTTPException(status_code=404, detail="Banner not found")
        image_key = BannerRepository.delete(banner_id)
        if image_key:
            try:
                delete_banner_image(image_key)
            except Exception as e:
                logger.warning(f"Could not delete banner S3 image {image_key}: {e}")
        return {"success": True, "message": f"Banner {banner_id} deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting banner {banner_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
