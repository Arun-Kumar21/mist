from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import Optional, List, Dict, Any
import logging

from db.models.audio_features import AudioFeatures
from db.database import get_db_session

logger = logging.getLogger(__name__)


class AudioFeaturesRepository:
    """Repository for audio features database operations"""
    
    @staticmethod
    def create(features_data: Dict[str, Any]) -> Optional[int]:
        """
        Create audio features for a track.
        
        Args:
            features_data: Dictionary containing audio feature attributes
            
        Returns:
            feature_id if successful, None otherwise
            
        Raises:
            IntegrityError: If duplicate or constraint violation
            SQLAlchemyError: For other database errors
        """
        try:
            with get_db_session() as session:
                features = AudioFeatures(**features_data)
                session.add(features)
                session.flush()
                feature_id = features.feature_id
                logger.info(f"Created audio features {feature_id} for track {features_data.get('track_id')}")
                return feature_id
        except IntegrityError as e:
            logger.error(f"Integrity error creating audio features: {e}")
            raise
        except SQLAlchemyError as e:
            logger.error(f"Database error creating audio features: {e}")
            raise
    
    @staticmethod
    def bulk_create(features_data_list: List[Dict[str, Any]]) -> int:
        """
        Bulk insert audio features.
        
        Args:
            features_data_list: List of dictionaries containing feature attributes
            
        Returns:
            Number of features inserted
            
        Raises:
            SQLAlchemyError: For database errors
        """
        try:
            with get_db_session() as session:
                features = [AudioFeatures(**data) for data in features_data_list]
                session.bulk_save_objects(features)
                count = len(features)
                logger.info(f"Bulk inserted {count} audio features")
                return count
        except SQLAlchemyError as e:
            logger.error(f"Error bulk inserting audio features: {e}")
            raise
    
    @staticmethod
    def get_by_track_id(track_id: int) -> Optional[AudioFeatures]:
        """
        Get audio features for a specific track.
        
        Args:
            track_id: The track ID
            
        Returns:
            AudioFeatures object if found, None otherwise
        """
        try:
            with get_db_session() as session:
                features = session.query(AudioFeatures).filter(
                    AudioFeatures.track_id == track_id
                ).first()
                if features:
                    session.expunge(features)
                return features
        except SQLAlchemyError as e:
            logger.error(f"Error fetching audio features for track {track_id}: {e}")
            raise
    
    @staticmethod
    def update(track_id: int, update_data: Dict[str, Any]) -> bool:
        """
        Update audio features for a track.
        
        Args:
            track_id: The track ID
            update_data: Dictionary of fields to update
            
        Returns:
            True if updated, False if features not found
            
        Raises:
            SQLAlchemyError: For database errors
        """
        try:
            with get_db_session() as session:
                features = session.query(AudioFeatures).filter(
                    AudioFeatures.track_id == track_id
                ).first()
                
                if not features:
                    logger.warning(f"Audio features for track {track_id} not found for update")
                    return False
                
                for key, value in update_data.items():
                    if hasattr(features, key):
                        setattr(features, key, value)
                
                logger.info(f"Updated audio features for track {track_id}")
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error updating audio features for track {track_id}: {e}")
            raise
    
    @staticmethod
    def delete(track_id: int) -> bool:
        """
        Delete audio features for a track.
        
        Args:
            track_id: The track ID
            
        Returns:
            True if deleted, False if features not found
            
        Raises:
            SQLAlchemyError: For database errors
        """
        try:
            with get_db_session() as session:
                features = session.query(AudioFeatures).filter(
                    AudioFeatures.track_id == track_id
                ).first()
                
                if not features:
                    logger.warning(f"Audio features for track {track_id} not found for deletion")
                    return False
                
                session.delete(features)
                logger.info(f"Deleted audio features for track {track_id}")
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error deleting audio features for track {track_id}: {e}")
            raise
