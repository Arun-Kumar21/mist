import os
from contextlib import contextmanager
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.pool import QueuePool
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not set")

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False,
    future=True
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    class_=Session,
    expire_on_commit=False
)

Base = declarative_base()


@contextmanager
def get_db_session():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Database session error: {e}")
        raise
    finally:
        session.close()


def create_tables():
    Base.metadata.create_all(engine)
    _run_lightweight_migrations()
    logger.info("Database tables created")


def _run_lightweight_migrations():
    """Apply small additive schema updates for environments without migrations."""
    statements = [
        "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS is_featured_home BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS home_feature_score INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS cover_image_url TEXT",
        "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS cover_image_key VARCHAR(1000)",
        "ALTER TABLE audio_features DROP CONSTRAINT IF EXISTS audio_features_track_id_fkey",
        (
            "ALTER TABLE audio_features "
            "ADD CONSTRAINT audio_features_track_id_fkey "
            "FOREIGN KEY (track_id) REFERENCES tracks(track_id) ON DELETE CASCADE"
        ),
        "ALTER TABLE track_embeddings DROP CONSTRAINT IF EXISTS track_embeddings_track_id_fkey",
        (
            "ALTER TABLE track_embeddings "
            "ADD CONSTRAINT track_embeddings_track_id_fkey "
            "FOREIGN KEY (track_id) REFERENCES tracks(track_id) ON DELETE CASCADE"
        ),
        "ALTER TABLE track_encryption_keys DROP CONSTRAINT IF EXISTS track_encryption_keys_track_id_fkey",
        (
            "ALTER TABLE track_encryption_keys "
            "ADD CONSTRAINT track_encryption_keys_track_id_fkey "
            "FOREIGN KEY (track_id) REFERENCES tracks(track_id) ON DELETE CASCADE"
        ),
        "ALTER TABLE processing_jobs DROP CONSTRAINT IF EXISTS processing_jobs_track_id_fkey",
        (
            "ALTER TABLE processing_jobs "
            "ADD CONSTRAINT processing_jobs_track_id_fkey "
            "FOREIGN KEY (track_id) REFERENCES tracks(track_id) ON DELETE CASCADE"
        ),
        "ALTER TABLE track_likes DROP CONSTRAINT IF EXISTS track_likes_track_id_fkey",
        (
            "ALTER TABLE track_likes "
            "ADD CONSTRAINT track_likes_track_id_fkey "
            "FOREIGN KEY (track_id) REFERENCES tracks(track_id) ON DELETE CASCADE"
        ),
        "ALTER TABLE playlist_tracks DROP CONSTRAINT IF EXISTS playlist_tracks_track_id_fkey",
        (
            "ALTER TABLE playlist_tracks "
            "ADD CONSTRAINT playlist_tracks_track_id_fkey "
            "FOREIGN KEY (track_id) REFERENCES tracks(track_id) ON DELETE CASCADE"
        ),
        "ALTER TABLE admin_curated_tracks DROP CONSTRAINT IF EXISTS admin_curated_tracks_track_id_fkey",
        (
            "ALTER TABLE admin_curated_tracks "
            "ADD CONSTRAINT admin_curated_tracks_track_id_fkey "
            "FOREIGN KEY (track_id) REFERENCES tracks(track_id) ON DELETE CASCADE"
        ),
        "ALTER TABLE user_listening_history DROP CONSTRAINT IF EXISTS user_listening_history_track_id_fkey",
        (
            "ALTER TABLE user_listening_history "
            "ADD CONSTRAINT user_listening_history_track_id_fkey "
            "FOREIGN KEY (track_id) REFERENCES tracks(track_id) ON DELETE CASCADE"
        ),
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
