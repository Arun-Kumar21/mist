#!/usr/bin/env python3
import sys
import logging
import time
import os
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def wait_for_database(max_retries=10, retry_delay=3):
    from sqlalchemy import create_engine
    from sqlalchemy.exc import OperationalError
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        logger.error("DATABASE_URL not found in environment variables")
        return False
    
    logger.info("Waiting for database to be ready...")
    
    for attempt in range(max_retries):
        try:
            engine = create_engine(database_url, pool_pre_ping=True)
            connection = engine.connect()
            connection.close()
            engine.dispose()
            logger.info("Database is ready!")
            return True
        except OperationalError as e:
            if attempt < max_retries - 1:
                logger.warning(f"Database not ready (attempt {attempt + 1}/{max_retries}): {e}")
                time.sleep(retry_delay)
            else:
                logger.error(f"Failed to connect to database after {max_retries} attempts")
                return False
        except Exception as e:
            logger.error(f"Unexpected error connecting to database: {e}")
            return False
    
    return False


def initialize_database():
    try:
        logger.info("Initializing database tables...")
        from init_db import create_tables
        create_tables()
        logger.info("Database tables initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}", exc_info=True)
        return False


def validate_environment():
    if not os.getenv('DATABASE_URL'):
        logger.error("Missing required environment variable: DATABASE_URL")
        return False
    
    if not os.getenv('SECRET_KEY'):
        logger.error("Missing required environment variable: SECRET_KEY")
        return False
    
    if not os.getenv('JWT_SECRET_KEY'):
        logger.warning("JWT_SECRET_KEY not set, will use SECRET_KEY as fallback")
    
    if not os.getenv('AWS_ACCESS_KEY_ID') or not os.getenv('AWS_SECRET_ACCESS_KEY'):
        logger.warning("AWS credentials not configured - S3 features will not work")
    
    logger.info("Environment validation passed")
    return True


def start_server():
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=port,
        workers=1,
        log_level="info"
    )


def main():
    logger.info("="*60)
    logger.info("MIST Music Platform - Starting Server")
    logger.info("="*60)
    
    logger.info("Step 1: Validating environment...")
    if not validate_environment():
        logger.error("Environment validation failed. Exiting.")
        sys.exit(1)
    
    logger.info("Step 2: Checking database connectivity...")
    if not wait_for_database():
        logger.error("Database is not available. Exiting.")
        sys.exit(1)
    
    logger.info("Step 3: Initializing database...")
    if not initialize_database():
        logger.error("Database initialization failed. Exiting.")
        sys.exit(1)
    
    logger.info("Step 4: Starting server...")
    try:
        start_server()
    except Exception as e:
        logger.error(f"Failed to start server: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
