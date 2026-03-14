from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import Optional, List, Dict, Any
import logging

from shared.db.models.audio_features import AudioFeatures
from shared.db.database import get_db_session

logger = logging.getLogger(__name__)


class AudioFeaturesRepository:

    @staticmethod
    def create(features_data: Dict[str, Any]) -> Optional[int]:
        try:
            with get_db_session() as session:
                features = AudioFeatures(**features_data)
                session.add(features)
                session.flush()
                return features.feature_id
        except IntegrityError as e:
            logger.error(f"Integrity error creating audio features: {e}")
            raise
        except SQLAlchemyError as e:
            logger.error(f"Database error creating audio features: {e}")
            raise

    @staticmethod
    def get_by_track_id(track_id: int) -> Optional[AudioFeatures]:
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
