from datetime import datetime, UTC
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import Optional, List, Dict, Any
import logging

from db.models.tracks import Track
from db.database import get_db_session

logger = logging.getLogger(__name__)


class TrackRepository:
    """Repository for track database operations"""
    
    @staticmethod
    def create(track_data: Dict[str, Any]) -> Optional[int]:
        """
        Create a single track record.
        
        Args:
            track_data: Dictionary containing track attributes
            
        Returns:
            track_id if successful, None otherwise
            
        Raises:
            IntegrityError: If duplicate or constraint violation
            SQLAlchemyError: For other database errors
        """
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
    def bulk_create(tracks_data: List[Dict[str, Any]]) -> int:
        """
        Bulk insert multiple tracks.
        
        Args:
            tracks_data: List of dictionaries containing track attributes
            
        Returns:
            Number of tracks inserted
            
        Raises:
            SQLAlchemyError: For database errors
        """
        try:
            with get_db_session() as session:
                tracks = [Track(**data) for data in tracks_data]
                session.bulk_save_objects(tracks)
                count = len(tracks)
                logger.info(f"Bulk inserted {count} tracks")
                return count
        except SQLAlchemyError as e:
            logger.error(f"Error bulk inserting tracks: {e}")
            raise
    
    @staticmethod
    def get_by_id(track_id: int) -> Optional[Track]:
        """
        Get a single track by ID.
        
        Args:
            track_id: The track ID
            
        Returns:
            Track object if found, None otherwise
        """
        try:
            with get_db_session() as session:
                track = session.query(Track).filter(Track.track_id == track_id).first()
                if track:
                    # Detach from session to avoid lazy loading issues
                    session.expunge(track)
                return track
        except SQLAlchemyError as e:
            logger.error(f"Error fetching track {track_id}: {e}")
            raise
    
    @staticmethod
    def get_all(limit: Optional[int] = None, offset: int = 0) -> List[Track]:
        """
        Get all tracks with pagination.
        
        Args:
            limit: Maximum number of tracks to return
            offset: Number of tracks to skip
            
        Returns:
            List of Track objects
        """
        try:
            with get_db_session() as session:
                query = session.query(Track).offset(offset)
                if limit:
                    query = query.limit(limit)
                tracks = query.all()
                # Detach from session
                for track in tracks:
                    session.expunge(track)
                return tracks
        except SQLAlchemyError as e:
            logger.error(f"Error fetching tracks: {e}")
            raise
    
    @staticmethod
    def get_by_genre(genre: str, limit: Optional[int] = None) -> List[Track]:
        """
        Get tracks by genre.
        
        Args:
            genre: Genre name
            limit: Maximum number of tracks to return
            
        Returns:
            List of Track objects
        """
        try:
            with get_db_session() as session:
                query = session.query(Track).filter(Track.genre_top == genre)
                if limit:
                    query = query.limit(limit)
                tracks = query.all()
                for track in tracks:
                    session.expunge(track)
                return tracks
        except SQLAlchemyError as e:
            logger.error(f"Error fetching tracks by genre {genre}: {e}")
            raise
    
    @staticmethod
    def search(search_term: str, limit: int = 20) -> List[Track]:
        """
        Search tracks by title or artist name.
        
        Args:
            search_term: Search string
            limit: Maximum number of results
            
        Returns:
            List of Track objects matching the search
        """
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
            logger.error(f"Error searching tracks with term '{search_term}': {e}")
            raise
    
    @staticmethod
    def update(track_id: int, update_data: Dict[str, Any]) -> bool:
        """
        Update a track by ID.
        
        Args:
            track_id: The track ID
            update_data: Dictionary of fields to update
            
        Returns:
            True if updated, False if track not found
            
        Raises:
            SQLAlchemyError: For database errors
        """
        try:
            with get_db_session() as session:
                track = session.query(Track).filter(Track.track_id == track_id).first()
                if not track:
                    logger.warning(f"Track {track_id} not found for update")
                    return False
                
                for key, value in update_data.items():
                    if hasattr(track, key):
                        setattr(track, key, value)
                
                track.updated_at = datetime.now(UTC)
                logger.info(f"Updated track {track_id}")
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error updating track {track_id}: {e}")
            raise
    
    @staticmethod
    def delete(track_id: int) -> bool:
        """
        Delete a track by ID.
        
        Args:
            track_id: The track ID
            
        Returns:
            True if deleted, False if track not found
            
        Raises:
            SQLAlchemyError: For database errors
        """
        try:
            with get_db_session() as session:
                track = session.query(Track).filter(Track.track_id == track_id).first()
                if not track:
                    logger.warning(f"Track {track_id} not found for deletion")
                    return False
                
                session.delete(track)
                logger.info(f"Deleted track {track_id}")
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error deleting track {track_id}: {e}")
            raise
    
    @staticmethod
    def count() -> int:
        """
        Get total number of tracks.
        
        Returns:
            Total track count
        """
        try:
            with get_db_session() as session:
                return session.query(Track).count()
        except SQLAlchemyError as e:
            logger.error(f"Error counting tracks: {e}")
            raise
