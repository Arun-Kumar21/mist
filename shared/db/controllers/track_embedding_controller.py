from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import Optional, List, Dict, Any, Tuple
import logging

from shared.db.models.track_embedding import TrackEmbedding
from shared.db.models.tracks import Track
from shared.db.database import get_db_session

logger = logging.getLogger(__name__)


class TrackEmbeddingRepository:

    @staticmethod
    def create(embedding_data: Dict[str, Any]) -> Optional[int]:
        try:
            with get_db_session() as session:
                embedding = TrackEmbedding(**embedding_data)
                session.add(embedding)
                session.flush()
                return embedding.embedding_id
        except IntegrityError as e:
            logger.error(f"Integrity error creating embedding: {e}")
            raise
        except SQLAlchemyError as e:
            logger.error(f"Database error creating embedding: {e}")
            raise

    @staticmethod
    def get_by_track_id(track_id: int) -> Optional[TrackEmbedding]:
        try:
            with get_db_session() as session:
                embedding = session.query(TrackEmbedding).filter(
                    TrackEmbedding.track_id == track_id
                ).first()
                if embedding:
                    session.expunge(embedding)
                return embedding
        except SQLAlchemyError as e:
            logger.error(f"Error fetching embedding for track {track_id}: {e}")
            raise

    @staticmethod
    def find_similar_tracks(track_id: int, limit: int = 10) -> List[Tuple[Track, float]]:
        try:
            with get_db_session() as session:
                target_embedding = session.query(TrackEmbedding).filter(
                    TrackEmbedding.track_id == track_id
                ).first()
                if not target_embedding:
                    return []
                similar = session.query(
                    Track,
                    TrackEmbedding.embedding_vector.cosine_distance(
                        target_embedding.embedding_vector
                    ).label('distance')
                ).join(
                    TrackEmbedding, Track.track_id == TrackEmbedding.track_id
                ).filter(
                    Track.track_id != track_id
                ).order_by('distance').limit(limit).all()
                results = []
                for track, distance in similar:
                    session.expunge(track)
                    results.append((track, float(distance)))
                return results
        except SQLAlchemyError as e:
            logger.error(f"Error finding similar tracks for track {track_id}: {e}")
            raise
