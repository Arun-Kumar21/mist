from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
import logging

from shared.db.controllers import AdminCuratedTrackRepository, TrackRepository
from middleware import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/curation", tags=["Curation"])


class UpsertCurationRequest(BaseModel):
    track_id: int
    display_order: int = 0
    is_active: bool = True


class UpdateCurationRequest(BaseModel):
    display_order: int = 0
    is_active: bool = True


@router.get("/top-picks")
async def get_top_picks(active_only: bool = Query(default=True)):
    try:
        rows = AdminCuratedTrackRepository.get_all(active_only=active_only)
        return {"success": True, "count": len(rows), "tracks": rows}
    except Exception as e:
        logger.error(f"Error fetching curation top picks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/top-picks")
@require_admin
async def add_top_pick(req: UpsertCurationRequest, request: Request):
    try:
        track = TrackRepository.get_by_id(req.track_id)
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")
        row = AdminCuratedTrackRepository.upsert(
            track_id=req.track_id,
            display_order=req.display_order,
            is_active=req.is_active,
        )
        return {"success": True, "curation": row.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error upserting top pick track: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/top-picks/{track_id}")
@require_admin
async def update_top_pick(track_id: int, req: UpdateCurationRequest, request: Request):
    try:
        if not TrackRepository.get_by_id(track_id):
            raise HTTPException(status_code=404, detail="Track not found")
        row = AdminCuratedTrackRepository.upsert(
            track_id=track_id,
            display_order=req.display_order,
            is_active=req.is_active,
        )
        return {"success": True, "curation": row.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating top pick track: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/top-picks/{track_id}")
@require_admin
async def delete_top_pick(track_id: int, request: Request):
    try:
        deleted = AdminCuratedTrackRepository.remove(track_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Curated track not found")
        return {"success": True, "message": f"Removed track {track_id} from curated list"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting top pick track: {e}")
        raise HTTPException(status_code=500, detail=str(e))
