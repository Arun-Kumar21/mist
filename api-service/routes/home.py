from fastapi import APIRouter, HTTPException, Query
import logging

from shared.db.controllers.analytics_controller import AnalyticsRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/home", tags=["Home"])


@router.get("/sections")
async def get_home_sections(limit: int = Query(default=10, ge=1, le=50)):
    try:
        return {
            "success": True,
            "sections": {
                "popular_songs": AnalyticsRepository.get_featured_home_tracks(limit),
                "most_listened": AnalyticsRepository.get_most_listened_tracks(limit),
                "top_pick": AnalyticsRepository.get_admin_top_picks(limit),
            },
        }
    except Exception as e:
        logger.error(f"Error fetching home sections: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/popular")
async def get_home_popular(limit: int = Query(default=10, ge=1, le=50)):
    try:
        tracks = AnalyticsRepository.get_featured_home_tracks(limit)
        return {"success": True, "count": len(tracks), "tracks": tracks}
    except Exception as e:
        logger.error(f"Error fetching home popular tracks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/most-listened")
async def get_home_most_listened(limit: int = Query(default=10, ge=1, le=50)):
    try:
        tracks = AnalyticsRepository.get_most_listened_tracks(limit)
        return {"success": True, "count": len(tracks), "tracks": tracks}
    except Exception as e:
        logger.error(f"Error fetching home most listened tracks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/top-pick")
async def get_home_top_pick(limit: int = Query(default=10, ge=1, le=50)):
    try:
        picks = AnalyticsRepository.get_admin_top_picks(limit)
        return {"success": True, "count": len(picks), "tracks": picks}
    except Exception as e:
        logger.error(f"Error fetching home top picks: {e}")
        raise HTTPException(status_code=500, detail=str(e))
