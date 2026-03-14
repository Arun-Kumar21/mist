from datetime import datetime, UTC
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import Optional, List, Dict, Any
import logging

from shared.db.models.tracks import Track
from shared.db.database import get_db_session

logger = logging.getLogger(__name__)


class TrackRepository:

    @staticmethod
    def create(track_data: Dict[str, Any]) -> Optional[int]:
        try:
            with get_db_session() as session:
                track = Track(**track_data)
                session.add(track)
                session.flush()
                track_id = track.track_id
                logger.info(f"Created track {track_id}: {track_data.get('title')}")
                return track_id
        except IntegrityError as e:
            logger.error(f"Integrity error creating track: {e}")
            raise
        except SQLAlchemyError as e:
            logger.error(f"Database error creating track: {e}")
            raise

    @staticmethod
    def get_by_id(track_id: int) -> Optional[Track]:
        try:
            with get_db_session() as session:
                track = session.query(Track).filter(Track.track_id == track_id).first()
                if track:
                    _ = (track.track_id, track.title, track.artist_name, track.album_title,
                         track.genre_top, track.duration_sec, track.cdn_url,
                         track.created_at, track.updated_at)
                    session.expunge(track)
                return track
        except SQLAlchemyError as e:
            logger.error(f"Error fetching track {track_id}: {e}")
            raise

    @staticmethod
    def get_all(limit: int = 20, offset: int = 0) -> List[Track]:
        try:
            with get_db_session() as session:
                tracks = session.query(Track).offset(offset).limit(limit).all()
                for track in tracks:
                    session.expunge(track)
                return tracks
        except SQLAlchemyError as e:
            logger.error(f"Error fetching tracks: {e}")
            raise

    @staticmethod
    def filter_by_genre(genre: str, limit: int = 20, offset: int = 0) -> List[Track]:
        try:
            with get_db_session() as session:
                tracks = session.query(Track).filter(
                    Track.genre_top == genre
                ).offset(offset).limit(limit).all()
                for track in tracks:
                    session.expunge(track)
                return tracks
        except SQLAlchemyError as e:
            logger.error(f"Error fetching tracks by genre {genre}: {e}")
            raise

    @staticmethod
    def search(search_term: str, limit: int = 20) -> List[Track]:
        try:
            with get_db_session() as session:
                tracks = session.query(Track).filter(
                    or_(
                        Track.title.ilike(f'%{search_term}%'),
                        Track.artist_name.ilike(f'%{search_term}%')
                    )
                ).limit(limit).all()
                for track in tracks:
                    session.expunge(track)
                return tracks
        except SQLAlchemyError as e:
            logger.error(f"Error searching tracks: {e}")
            raise

    @staticmethod
    def update(track_id: int, update_data: Dict[str, Any]) -> bool:
        try:
            with get_db_session() as session:
                track = session.query(Track).filter(Track.track_id == track_id).first()
                if not track:
                    return False
                for key, value in update_data.items():
                    if hasattr(track, key):
                        setattr(track, key, value)
                track.updated_at = datetime.now(UTC)
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error updating track {track_id}: {e}")
            raise

    @staticmethod
    def delete(track_id: int) -> bool:
        try:
            with get_db_session() as session:
                track = session.query(Track).filter(Track.track_id == track_id).first()
                if not track:
                    return False
                session.delete(track)
                logger.info(f"Deleted track {track_id}")
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error deleting track {track_id}: {e}")
            raise
