from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import Optional, Dict, Any
import logging
import secrets

from db.models.track_encryption_keys import TrackEncryptionKeys
from db.database import get_db_session

logger = logging.getLogger(__name__)


class TrackEncryptionKeysRepository:
    """Repository for track encryption keys database operations"""
    
    @staticmethod
    def create(track_id: int, encryption_key: Optional[bytes] = None) -> Optional[int]:
        """
        Create encryption key for a track.
        
        Args:
            track_id: The track ID to create key for
            encryption_key: Optional 16-byte AES-128 key. If None, generates a random key.
            
        Returns:
            encryption_key_id if successful, None otherwise
            
        Raises:
            IntegrityError: If duplicate or constraint violation
            SQLAlchemyError: For other database errors
            ValueError: If provided key is not 16 bytes
        """
        try:
            # Generate random 16-byte AES-128 key if not provided
            if encryption_key is None:
                encryption_key = secrets.token_bytes(16)
            elif len(encryption_key) != 16:
                raise ValueError("Encryption key must be exactly 16 bytes for AES-128")
            
            with get_db_session() as session:
                key_record = TrackEncryptionKeys(
                    track_id=track_id,
                    encryption_key=encryption_key
                )
                session.add(key_record)
                session.flush()
                key_id = key_record.id
                logger.info(f"Created encryption key {key_id} for track {track_id}")
                return key_id
        except IntegrityError as e:
            logger.error(f"Integrity error creating encryption key: {e}")
            raise
        except SQLAlchemyError as e:
            logger.error(f"Database error creating encryption key: {e}")
            raise
    
    @staticmethod
    def get_by_track_id(track_id: int, include_key: bool = False) -> Optional[TrackEncryptionKeys]:
        """
        Get encryption key for a specific track.
        
        Args:
            track_id: The track ID
            include_key: Whether to include key in result (for secure delivery)
            
        Returns:
            TrackEncryptionKeys object if found, None otherwise
        """
        try:
            with get_db_session() as session:
                key_record = session.query(TrackEncryptionKeys).filter(
                    TrackEncryptionKeys.track_id == track_id
                ).first()
                
                if key_record:
                    session.expunge(key_record)
                    # Store the include_key flag for later use
                    key_record._include_key = include_key
                return key_record
        except SQLAlchemyError as e:
            logger.error(f"Error fetching encryption key for track {track_id}: {e}")
            raise
    
    @staticmethod
    def get_by_id(key_id: int) -> Optional[TrackEncryptionKeys]:
        """
        Get encryption key by ID.
        
        Args:
            key_id: The encryption key ID
            
        Returns:
            TrackEncryptionKeys object if found, None otherwise
        """
        try:
            with get_db_session() as session:
                key_record = session.query(TrackEncryptionKeys).filter(
                    TrackEncryptionKeys.id == key_id
                ).first()
                
                if key_record:
                    session.expunge(key_record)
                return key_record
        except SQLAlchemyError as e:
            logger.error(f"Error fetching encryption key {key_id}: {e}")
            raise
    
    @staticmethod
    def update(track_id: int, new_encryption_key: bytes) -> bool:
        """
        Update encryption key for a track.
        
        Args:
            track_id: The track ID
            new_encryption_key: New 16-byte AES-128 key
            
        Returns:
            True if updated successfully, False if not found
            
        Raises:
            SQLAlchemyError: For database errors
            ValueError: If provided key is not 16 bytes
        """
        try:
            if len(new_encryption_key) != 16:
                raise ValueError("Encryption key must be exactly 16 bytes for AES-128")
            
            with get_db_session() as session:
                key_record = session.query(TrackEncryptionKeys).filter(
                    TrackEncryptionKeys.track_id == track_id
                ).first()
                
                if not key_record:
                    logger.warning(f"Encryption key for track {track_id} not found for update")
                    return False
                
                key_record.encryption_key = new_encryption_key
                logger.info(f"Updated encryption key for track {track_id}")
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error updating encryption key for track {track_id}: {e}")
            raise
    
    @staticmethod
    def delete_by_track_id(track_id: int) -> bool:
        """
        Delete encryption key for a track.
        
        Args:
            track_id: The track ID
            
        Returns:
            True if deleted successfully, False if not found
            
        Raises:
            SQLAlchemyError: For database errors
        """
        try:
            with get_db_session() as session:
                deleted_count = session.query(TrackEncryptionKeys).filter(
                    TrackEncryptionKeys.track_id == track_id
                ).delete()
                
                if deleted_count > 0:
                    logger.info(f"Deleted encryption key for track {track_id}")
                    return True
                else:
                    logger.warning(f"No encryption key found for track {track_id}")
                    return False
        except SQLAlchemyError as e:
            logger.error(f"Error deleting encryption key for track {track_id}: {e}")
            raise
    
    @staticmethod
    def exists(track_id: int) -> bool:
        """
        Check if encryption key exists for a track.
        
        Args:
            track_id: The track ID
            
        Returns:
            True if key exists, False otherwise
        """
        try:
            with get_db_session() as session:
                exists = session.query(TrackEncryptionKeys).filter(
                    TrackEncryptionKeys.track_id == track_id
                ).first() is not None
                return exists
        except SQLAlchemyError as e:
            logger.error(f"Error checking encryption key existence for track {track_id}: {e}")
            raise
    
    @staticmethod
    def get_key_bytes(track_id: int) -> Optional[bytes]:
        """
        Get raw encryption key bytes for a track (for HLS decryption).
        
        Args:
            track_id: The track ID
            
        Returns:
            16-byte encryption key if found, None otherwise
        """
        try:
            with get_db_session() as session:
                key_record = session.query(TrackEncryptionKeys).filter(
                    TrackEncryptionKeys.track_id == track_id
                ).first()
                
                if key_record:
                    return key_record.encryption_key
                return None
        except SQLAlchemyError as e:
            logger.error(f"Error fetching encryption key bytes for track {track_id}: {e}")
            raise
