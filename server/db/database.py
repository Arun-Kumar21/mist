import os 
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not found in environment variables")

engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,
    echo=False,
    future=True
)

# Create session factory
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    class_=Session,
    expire_on_commit=False
)

# Declarative base for models
Base = declarative_base()


@contextmanager
def get_db_session():
    """
    Context manager for database sessions with automatic commit/rollback.
    
    Usage:
        with get_db_session() as session:
            # Your database operations
            session.add(obj)
    """
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


def get_session():
    """
    Get a new database session (manual management required).
    Prefer using get_db_session() context manager.
    """
    return SessionLocal()


def create_tables():
    """Create all tables in the database"""
    try:
        Base.metadata.create_all(engine)
        logger.info("Database tables created successfully")
        logger.info("Tables: tracks, audio_features, track_embeddings")
    except Exception as e:
        logger.error(f"Error creating tables: {e}")
        raise


def drop_tables():
    """Drop all tables (use with caution!)"""
    try:
        Base.metadata.drop_all(engine)
        logger.warning("Database tables dropped")
    except Exception as e:
        logger.error(f"Error dropping tables: {e}")
        raise


if __name__ == "__main__":
    create_tables()
