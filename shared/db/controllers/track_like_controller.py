from typing import List, Dict, Any
from uuid import UUID
from sqlalchemy.exc import IntegrityError
from sqlalchemy import desc

from shared.db.database import get_db_session
from shared.db.models.track_like import TrackLike
from shared.db.models.tracks import Track


class TrackLikeRepository:

    @staticmethod
    def like_track(user_id: UUID, track_id: int) -> bool:
        with get_db_session() as session:
            existing = session.query(TrackLike).filter(
                TrackLike.user_id == user_id,
                TrackLike.track_id == track_id,
            ).first()
            if existing:
                return False
            like = TrackLike(user_id=user_id, track_id=track_id)
            session.add(like)
            return True

    @staticmethod
    def unlike_track(user_id: UUID, track_id: int) -> bool:
        with get_db_session() as session:
            row = session.query(TrackLike).filter(
                TrackLike.user_id == user_id,
                TrackLike.track_id == track_id,
            ).first()
            if not row:
                return False
            session.delete(row)
            return True

    @staticmethod
    def is_liked(user_id: UUID, track_id: int) -> bool:
        with get_db_session() as session:
            return session.query(TrackLike).filter(
                TrackLike.user_id == user_id,
                TrackLike.track_id == track_id,
            ).first() is not None

    @staticmethod
    def get_liked_tracks(user_id: UUID, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        with get_db_session() as session:
            rows = session.query(TrackLike, Track).join(
                Track, Track.track_id == TrackLike.track_id
            ).filter(
                TrackLike.user_id == user_id
            ).order_by(desc(TrackLike.created_at)).offset(offset).limit(limit).all()
            return [
                {
                    'liked_at': like.created_at.isoformat() if like.created_at else None,
                    'track': track.to_dict(),
                }
                for like, track in rows
            ]
