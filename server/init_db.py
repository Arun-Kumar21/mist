import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from db.database import Base, engine
from db.models import Track, AudioFeatures, TrackEmbedding, ProcessingJob, TrackEncryptionKeys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_tables():
    """Create all database tables"""
    
    try:
        logger.info("Creating database tables...")
        
        Track.__table__.create(engine, checkfirst=True)
        logger.info("✓ Created 'tracks' table")
        
        AudioFeatures.__table__.create(engine, checkfirst=True)
        logger.info("✓ Created 'audio_features' table")
        
        TrackEmbedding.__table__.create(engine, checkfirst=True)
        logger.info("✓ Created 'track_embeddings' table")
        
        ProcessingJob.__table__.create(engine, checkfirst=True)
        logger.info("✓ Created 'processing_jobs' table")
        
        TrackEncryptionKeys.__table__.create(engine, checkfirst=True)
        logger.info("✓ Created 'track_encryption_keys' table")
        
        logger.info("Database initialization complete!")
        
    except Exception as e:
        logger.error(f"Error creating tables: {e}")
        raise


if __name__ == "__main__":
    create_tables()
