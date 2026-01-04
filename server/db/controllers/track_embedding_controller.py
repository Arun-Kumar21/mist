from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import Optional, List, Dict, Any, Tuple
import logging

from db.models.track_embedding import TrackEmbedding
from db.models.tracks import Track
from db.database import get_db_session

logger = logging.getLogger(__name__)


class TrackEmbeddingRepository:
    """Repository for track embedding database operations"""
    
    @staticmethod
    def create(embedding_data: Dict[str, Any]) -> Optional[int]:
        """
        Create a track embedding.
        
        Args:
            embedding_data: Dictionary containing embedding attributes
            
        Returns:
            embedding_id if successful, None otherwise
            
        Raises:
            IntegrityError: If duplicate or constraint violation
            SQLAlchemyError: For other database errors
        """
        try:
            with get_db_session() as session:
                embedding = TrackEmbedding(**embedding_data)
                session.add(embedding)
                session.flush()
                embedding_id = embedding.embedding_id
                logger.info(f"Created embedding {embedding_id} for track {embedding_data.get('track_id')}")
                return embedding_id
        except IntegrityError as e:
            logger.error(f"Integrity error creating embedding: {e}")
            raise
        except SQLAlchemyError as e:
            logger.error(f"Database error creating embedding: {e}")
            raise
    
    @staticmethod
    def bulk_create(embeddings_data_list: List[Dict[str, Any]]) -> int:
        """
        Bulk insert embeddings.
        
        Args:
            embeddings_data_list: List of dictionaries containing embedding attributes
            
        Returns:
            Number of embeddings inserted
            
        Raises:
            SQLAlchemyError: For database errors
        """
        try:
            with get_db_session() as session:
                embeddings = [TrackEmbedding(**data) for data in embeddings_data_list]
                session.bulk_save_objects(embeddings)
                count = len(embeddings)
                logger.info(f"Bulk inserted {count} embeddings")
                return count
        except SQLAlchemyError as e:
            logger.error(f"Error bulk inserting embeddings: {e}")
            raise
    
    @staticmethod
    def get_by_track_id(track_id: int) -> Optional[TrackEmbedding]:
        """
        Get embedding for a specific track.
        
        Args:
            track_id: The track ID
            
        Returns:
            TrackEmbedding object if found, None otherwise
        """
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
        """
        Find similar tracks using vector similarity (cosine distance).
        
        Args:
            track_id: The target track ID
            limit: Maximum number of similar tracks to return
            
        Returns:
            List of tuples (Track, distance) ordered by similarity
        """
        try:
            with get_db_session() as session:
                # Get the target track's embedding
                target_embedding = session.query(TrackEmbedding).filter(
                    TrackEmbedding.track_id == track_id
                ).first()
                
                if not target_embedding:
                    logger.warning(f"No embedding found for track {track_id}")
                    return []
                
                # Find similar tracks using cosine distance
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
                
                # Detach from session and convert to list
                results = []
                for track, distance in similar:
                    session.expunge(track)
                    results.append((track, float(distance)))
                
                logger.info(f"Found {len(results)} similar tracks for track {track_id}")
                return results
        except SQLAlchemyError as e:
            logger.error(f"Error finding similar tracks for track {track_id}: {e}")
            raise
    
    @staticmethod
    def update(track_id: int, update_data: Dict[str, Any]) -> bool:
        """
        Update embedding for a track.
        
        Args:
            track_id: The track ID
            update_data: Dictionary of fields to update
            
        Returns:
            True if updated, False if embedding not found
            
        Raises:
            SQLAlchemyError: For database errors
        """
        try:
            with get_db_session() as session:
                embedding = session.query(TrackEmbedding).filter(
                    TrackEmbedding.track_id == track_id
                ).first()
                
                if not embedding:
                    logger.warning(f"Embedding for track {track_id} not found for update")
                    return False
                
                for key, value in update_data.items():
                    if hasattr(embedding, key):
                        setattr(embedding, key, value)
                
                logger.info(f"Updated embedding for track {track_id}")
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error updating embedding for track {track_id}: {e}")
            raise
    
    @staticmethod
    def delete(track_id: int) -> bool:
        """
        Delete embedding for a track.
        
        Args:
            track_id: The track ID
            
        Returns:
            True if deleted, False if embedding not found
            
        Raises:
            SQLAlchemyError: For database errors
        """
        try:
            with get_db_session() as session:
                embedding = session.query(TrackEmbedding).filter(
                    TrackEmbedding.track_id == track_id
                ).first()
                
                if not embedding:
                    logger.warning(f"Embedding for track {track_id} not found for deletion")
                    return False
                
                session.delete(embedding)
                logger.info(f"Deleted embedding for track {track_id}")
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error deleting embedding for track {track_id}: {e}")
            raise
