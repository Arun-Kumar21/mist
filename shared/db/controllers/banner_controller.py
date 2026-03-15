from datetime import datetime, UTC
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional, List, Dict, Any
import logging

from shared.db.models.banner import Banner
from shared.db.database import get_db_session

logger = logging.getLogger(__name__)


class BannerRepository:

    @staticmethod
    def create(banner_data: Dict[str, Any]) -> Optional[int]:
        try:
            with get_db_session() as session:
                banner = Banner(**banner_data)
                session.add(banner)
                session.flush()
                banner_id = banner.banner_id
                logger.info(f"Created banner {banner_id}: {banner_data.get('title')}")
                return banner_id
        except SQLAlchemyError as e:
            logger.error(f"Database error creating banner: {e}")
            raise

    @staticmethod
    def get_by_id(banner_id: int) -> Optional[Banner]:
        try:
            with get_db_session() as session:
                banner = session.query(Banner).filter(Banner.banner_id == banner_id).first()
                if banner:
                    session.expunge(banner)
                return banner
        except SQLAlchemyError as e:
            logger.error(f"Error fetching banner {banner_id}: {e}")
            raise

    @staticmethod
    def get_active() -> List[Banner]:
        try:
            with get_db_session() as session:
                banners = (
                    session.query(Banner)
                    .filter(Banner.is_active == True)  # noqa: E712
                    .order_by(Banner.display_order.asc(), Banner.created_at.desc())
                    .all()
                )
                for b in banners:
                    session.expunge(b)
                return banners
        except SQLAlchemyError as e:
            logger.error(f"Error fetching active banners: {e}")
            raise

    @staticmethod
    def get_all() -> List[Banner]:
        try:
            with get_db_session() as session:
                banners = (
                    session.query(Banner)
                    .order_by(Banner.display_order.asc(), Banner.created_at.desc())
                    .all()
                )
                for b in banners:
                    session.expunge(b)
                return banners
        except SQLAlchemyError as e:
            logger.error(f"Error fetching all banners: {e}")
            raise

    @staticmethod
    def update(banner_id: int, update_data: Dict[str, Any]) -> bool:
        try:
            with get_db_session() as session:
                banner = session.query(Banner).filter(Banner.banner_id == banner_id).first()
                if not banner:
                    return False
                for key, value in update_data.items():
                    if hasattr(banner, key):
                        setattr(banner, key, value)
                banner.updated_at = datetime.now(UTC)
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error updating banner {banner_id}: {e}")
            raise

    @staticmethod
    def delete(banner_id: int) -> Optional[str]:
        """Delete a banner and return its S3 image_key for cleanup, or None."""
        try:
            with get_db_session() as session:
                banner = session.query(Banner).filter(Banner.banner_id == banner_id).first()
                if not banner:
                    return None
                image_key = banner.image_key
                session.delete(banner)
                logger.info(f"Deleted banner {banner_id}")
                return image_key
        except SQLAlchemyError as e:
            logger.error(f"Error deleting banner {banner_id}: {e}")
            raise
