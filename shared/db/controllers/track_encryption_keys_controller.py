from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import Optional, Dict, Any
import logging
import secrets

from shared.db.models.track_encryption_keys import TrackEncryptionKeys
from shared.db.database import get_db_session

logger = logging.getLogger(__name__)


class TrackEncryptionKeysRepository:

    @staticmethod
    def create(track_id: int, encryption_key: Optional[bytes] = None) -> Optional[int]:
        try:
            if encryption_key is None:
                encryption_key = secrets.token_bytes(16)
            elif len(encryption_key) != 16:
                raise ValueError("Encryption key must be exactly 16 bytes")
            with get_db_session() as session:
                key_record = TrackEncryptionKeys(track_id=track_id, encryption_key=encryption_key)
                session.add(key_record)
                session.flush()
                return key_record.id
        except IntegrityError as e:
            logger.error(f"Integrity error creating encryption key: {e}")
            raise
        except SQLAlchemyError as e:
            logger.error(f"Database error creating encryption key: {e}")
            raise

    @staticmethod
    def get_by_track_id(track_id: int) -> Optional[TrackEncryptionKeys]:
        try:
            with get_db_session() as session:
                key_record = session.query(TrackEncryptionKeys).filter(
                    TrackEncryptionKeys.track_id == track_id
                ).first()
                if key_record:
                    session.expunge(key_record)
                return key_record
        except SQLAlchemyError as e:
            logger.error(f"Error fetching encryption key for track {track_id}: {e}")
            raise

    @staticmethod
    def get_key_bytes(track_id: int) -> Optional[bytes]:
        key_record = TrackEncryptionKeysRepository.get_by_track_id(track_id)
        if key_record:
            return key_record.get_key_bytes()
        return None
