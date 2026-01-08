from datetime import datetime, UTC
from pydantic import BaseModel
from typing import Optional, List
import logging
from uuid import UUID

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from db.models.user import User, UserRole
from util.security import generate_hash_password, verify_password
from db.database import get_db_session


logger = logging.getLogger(__name__)

class UserCreate(BaseModel):
    username: str
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None

class UserRepository:
    """Repository for user operations"""

    @staticmethod
    def create_user(data: UserCreate):
        """
        Create user for signup request
        
        Args: 
            data: UserCreate object with username, password, and optional role

        Returns:
            user_id (UUID) if successful, None otherwise

        Raises:
            IntegrityError: If duplicate username or constraint violation
            SQLAlchemyError: For other database errors
        """
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
        """
        Get a user by ID.
        
        Args:
            user_id: The user UUID
            
        Returns:
            User object if found, None otherwise
        """
        try:
            with get_db_session() as session:
                user = session.query(User).filter(User.user_id == user_id).first()
                if user:
                    _ = user.user_id
                    _ = user.username
                    _ = user.role
                    _ = user.last_login_at
                    _ = user.created_at
                    _ = user.updated_at
                    session.expunge(user)
                return user
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user {user_id}: {e}")
            raise
    
    @staticmethod
    def get_by_username(username: str) -> Optional[User]:
        """
        Get a user by username.
        
        Args:
            username: The username to search for
            
        Returns:
            User object if found, None otherwise
        """
        try:
            with get_db_session() as session:
                user = session.query(User).filter(User.username == username).first()
                if user:
                    _ = user.user_id
                    _ = user.username
                    _ = user.role
                    _ = user.last_login_at
                    _ = user.created_at
                    _ = user.updated_at
                    session.expunge(user)
                return user
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by username {username}: {e}")
            raise
    
    @staticmethod
    def get_all(limit: Optional[int] = None, offset: int = 0) -> List[User]:
        """
        Get all users with pagination.
        
        Args:
            limit: Maximum number of users to return
            offset: Number of users to skip
            
        Returns:
            List of User objects
        """
        try:
            with get_db_session() as session:
                query = session.query(User).offset(offset)
                if limit:
                    query = query.limit(limit)
                users = query.all()
                for user in users:
                    _ = user.user_id
                    _ = user.username
                    _ = user.role
                    _ = user.last_login_at
                    _ = user.created_at
                    _ = user.updated_at
                    session.expunge(user)
                return users
        except SQLAlchemyError as e:
            logger.error(f"Error fetching users: {e}")
            raise
    
    @staticmethod
    def verify_credentials(username: str, password: str) -> Optional[User]:
        """
        Verify user credentials for authentication.
        
        Args:
            username: The username
            password: The plain text password to verify
            
        Returns:
            User object if credentials are valid, None otherwise (password_hash excluded)
        """
        try:
            # Fetch user with password_hash for verification only
            with get_db_session() as session:
                user = session.query(User).filter(User.username == username).first()
                if not user:
                    logger.warning(f"User not found for credential verification: {username}")
                    return None
                
                password_hash = user.password_hash
                
                # Verify password
                if not verify_password(password, str(password_hash)):
                    logger.warning(f"Failed password verification for user: {username}")
                    return None
                
                _ = user.user_id
                _ = user.username
                _ = user.role
                _ = user.last_login_at
                _ = user.created_at
                _ = user.updated_at
                session.expunge(user)
                
                logger.info(f"Successfully verified credentials for user: {username}")
                return user
                
        except Exception as e:
            logger.error(f"Error verifying credentials for {username}: {e}")
            raise
    
    @staticmethod
    def update_user(user_id: UUID, data: UserUpdate) -> bool:
        """
        Update user information.
        
        Args:
            user_id: The user UUID
            data: UserUpdate object with fields to update
            
        Returns:
            True if update successful, False otherwise
            
        Raises:
            IntegrityError: If username already exists
            SQLAlchemyError: For other database errors
        """
        try:
            with get_db_session() as session:
                user = session.query(User).filter(User.user_id == user_id).first()
                if not user:
                    logger.warning(f"User {user_id} not found for update")
                    return False
                
                # Update fields if provided
                if data.username is not None:
                    user.username = data.username
                if data.password is not None:
                    user.password_hash = generate_hash_password(data.password)
                
                user.updated_at = datetime.now(UTC)
                session.flush()
                logger.info(f"Updated user {user_id}")
                return True
                
        except IntegrityError as e:
            logger.error(f"Integrity error updating user {user_id}: {e}")
            raise
        except SQLAlchemyError as e:
            logger.error(f"Database error updating user {user_id}: {e}")
            raise
    
    @staticmethod
    def update_last_login(user_id: UUID) -> bool:
        """
        Update the last login timestamp for a user.
        
        Args:
            user_id: The user UUID
            
        Returns:
            True if update successful, False otherwise
        """
        try:
            with get_db_session() as session:
                user = session.query(User).filter(User.user_id == user_id).first()
                if not user:
                    logger.warning(f"User {user_id} not found for last login update")
                    return False
                
                user.last_login_at = datetime.now(UTC)
                session.flush()
                logger.info(f"Updated last login for user {user_id}")
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error updating last login for user {user_id}: {e}")
            raise
    
    @staticmethod
    def delete_user(user_id: UUID) -> bool:
        """
        Delete a user by ID.
        
        Args:
            user_id: The user UUID
            
        Returns:
            True if deletion successful, False if user not found
            
        Raises:
            SQLAlchemyError: For database errors
        """
        try:
            with get_db_session() as session:
                user = session.query(User).filter(User.user_id == user_id).first()
                if not user:
                    logger.warning(f"User {user_id} not found for deletion")
                    return False
                
                session.delete(user)
                session.flush()
                logger.info(f"Deleted user {user_id}")
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error deleting user {user_id}: {e}")
            raise
    
    @staticmethod
    def get_by_role(role: UserRole, limit: Optional[int] = None) -> List[User]:
        """
        Get users by role.
        
        Args:
            role: The user role to filter by
            limit: Maximum number of users to return
            
        Returns:
            List of User objects
        """
        try:
            with get_db_session() as session:
                query = session.query(User).filter(User.role == role)
                if limit:
                    query = query.limit(limit)
                users = query.all()
                for user in users:
                    _ = user.user_id
                    _ = user.username
                    _ = user.role
                    _ = user.last_login_at
                    _ = user.created_at
                    _ = user.updated_at
                    session.expunge(user)
                return users
        except SQLAlchemyError as e:
            logger.error(f"Error fetching users by role {role}: {e}")
            raise
    
    @staticmethod
    def user_exists(username: str) -> bool:
        """
        Check if a user with the given username exists.
        
        Args:
            username: The username to check
            
        Returns:
            True if user exists, False otherwise
        """
        try:
            with get_db_session() as session:
                exists = session.query(User).filter(User.username == username).first() is not None
                return exists
        except SQLAlchemyError as e:
            logger.error(f"Error checking if user exists: {e}")
            raise
    
