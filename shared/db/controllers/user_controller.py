from datetime import datetime, UTC
from pydantic import BaseModel
from typing import Optional, List
import logging
from uuid import UUID

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from shared.db.models.user import User, UserRole
from shared.util.security import generate_hash_password, verify_password
from shared.db.database import get_db_session

logger = logging.getLogger(__name__)


class UserCreate(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None


class UserRepository:

    @staticmethod
    def create_user(data: UserCreate):
        try:
            with get_db_session() as session:
                user = User(
                    username=data.username,
                    password_hash=generate_hash_password(data.password),
                )
                session.add(user)
                session.flush()
                user_id = user.user_id
                logger.info(f"Created user {user_id}: {user.username}")
                return user_id
        except IntegrityError as e:
            logger.error(f"Integrity error creating user: {e}")
            raise
        except SQLAlchemyError as e:
            logger.error(f"Database error creating user: {e}")
            raise

    @staticmethod
    def get_by_id(user_id: UUID) -> Optional[User]:
        try:
            with get_db_session() as session:
                user = session.query(User).filter(User.user_id == user_id).first()
                if user:
                    _ = user.user_id, user.username, user.role, user.last_login_at
                    _ = user.created_at, user.updated_at
                    session.expunge(user)
                return user
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user {user_id}: {e}")
            raise

    @staticmethod
    def get_by_username(username: str) -> Optional[User]:
        try:
            with get_db_session() as session:
                user = session.query(User).filter(User.username == username).first()
                if user:
                    _ = user.user_id, user.username, user.role, user.last_login_at
                    _ = user.created_at, user.updated_at
                    session.expunge(user)
                return user
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by username {username}: {e}")
            raise

    @staticmethod
    def verify_credentials(username: str, password: str) -> Optional[User]:
        try:
            with get_db_session() as session:
                user = session.query(User).filter(User.username == username).first()
                if not user:
                    return None
                if not verify_password(password, str(user.password_hash)):
                    return None
                _ = user.user_id, user.username, user.role, user.last_login_at
                _ = user.created_at, user.updated_at
                session.expunge(user)
                return user
        except Exception as e:
            logger.error(f"Error verifying credentials for {username}: {e}")
            raise

    @staticmethod
    def update_last_login(user_id: UUID) -> bool:
        try:
            with get_db_session() as session:
                user = session.query(User).filter(User.user_id == user_id).first()
                if not user:
                    return False
                user.last_login_at = datetime.now(UTC)
                session.flush()
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error updating last login for user {user_id}: {e}")
            raise

    @staticmethod
    def delete_user(user_id: UUID) -> bool:
        try:
            with get_db_session() as session:
                user = session.query(User).filter(User.user_id == user_id).first()
                if not user:
                    return False
                session.delete(user)
                session.flush()
                logger.info(f"Deleted user {user_id}")
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error deleting user {user_id}: {e}")
            raise
