from datetime import datetime, UTC
from pydantic import BaseModel
from typing import Optional
import logging
from uuid import UUID

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from shared.db.models.user import User
from shared.util.security import generate_hash_password, verify_password
from shared.db.database import get_db_session

logger = logging.getLogger(__name__)


class UserCreate(BaseModel):
    email: str
    username: str
    password: Optional[str] = None


class UserUpdate(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


class UserRepository:

    @staticmethod
    def _normalize_email(email: str) -> str:
        return email.strip().lower()

    @staticmethod
    def _normalize_username(username: str) -> str:
        return username.strip()

    @staticmethod
    def _detach_user(user: User, session):
        _ = user.user_id, user.email, user.username, user.role
        _ = user.last_login_at, user.created_at, user.updated_at
        session.expunge(user)
        return user

    @staticmethod
    def create_user(data: UserCreate):
        try:
            with get_db_session() as session:
                user = User(
                    email=UserRepository._normalize_email(data.email),
                    username=UserRepository._normalize_username(data.username),
                    password_hash=generate_hash_password(data.password) if data.password else None,
                )
                session.add(user)
                session.flush()
                user_id = user.user_id
                logger.info(f"Created user {user_id}: {user.email}")
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
                    return UserRepository._detach_user(user, session)
                return user
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user {user_id}: {e}")
            raise

    @staticmethod
    def get_by_email(email: str) -> Optional[User]:
        try:
            with get_db_session() as session:
                user = session.query(User).filter(User.email == UserRepository._normalize_email(email)).first()
                if user:
                    return UserRepository._detach_user(user, session)
                return user
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by email {email}: {e}")
            raise

    @staticmethod
    def get_by_username(username: str) -> Optional[User]:
        try:
            with get_db_session() as session:
                user = session.query(User).filter(User.username == UserRepository._normalize_username(username)).first()
                if user:
                    return UserRepository._detach_user(user, session)
                return user
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by username {username}: {e}")
            raise

    @staticmethod
    def verify_credentials(email: str, password: str) -> Optional[User]:
        try:
            with get_db_session() as session:
                user = session.query(User).filter(User.email == UserRepository._normalize_email(email)).first()
                if not user:
                    return None
                if not verify_password(password, str(user.password_hash) if user.password_hash else ""):
                    return None
                return UserRepository._detach_user(user, session)
        except Exception as e:
            logger.error(f"Error verifying credentials for {email}: {e}")
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
