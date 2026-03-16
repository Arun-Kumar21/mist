from datetime import datetime, UTC
from typing import Optional, List, Dict, Any
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

from shared.db.database import get_db_session
from shared.db.models.admin_curated_track import AdminCuratedTrack
from shared.db.models.tracks import Track


class AdminCuratedTrackRepository:

    @staticmethod
    def upsert(track_id: int, display_order: int = 0, is_active: bool = True) -> AdminCuratedTrack:
        with get_db_session() as session:
            existing = session.query(AdminCuratedTrack).filter(AdminCuratedTrack.track_id == track_id).first()
            if existing:
                existing.display_order = display_order
                existing.is_active = is_active
                existing.updated_at = datetime.now(UTC)
                session.flush()
                session.expunge(existing)
                return existing

            curated = AdminCuratedTrack(track_id=track_id, display_order=display_order, is_active=is_active)
            session.add(curated)
            session.flush()
            session.expunge(curated)
            return curated

    @staticmethod
    def get_all(active_only: bool = True) -> List[Dict[str, Any]]:
        with get_db_session() as session:
            query = session.query(AdminCuratedTrack, Track).join(Track, Track.track_id == AdminCuratedTrack.track_id)
            if active_only:
                query = query.filter(AdminCuratedTrack.is_active == True)  # noqa: E712
            rows = query.order_by(AdminCuratedTrack.display_order.asc(), AdminCuratedTrack.updated_at.desc()).all()
            return [
                {
                    'curation': curated.to_dict(),
                    'track': track.to_dict(),
                }
                for curated, track in rows
            ]

    @staticmethod
    def remove(track_id: int) -> bool:
        with get_db_session() as session:
            row = session.query(AdminCuratedTrack).filter(AdminCuratedTrack.track_id == track_id).first()
            if not row:
                return False
            session.delete(row)
            return True
