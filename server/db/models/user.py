from sqlalchemy import Column, String, DateTime, Enum as SQLEnum
from datetime import datetime, UTC
from sqlalchemy.dialects.postgresql import UUID
import uuid
from enum import Enum

from db.database import Base

class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"


class User(Base):
    """User Model for storing user data"""
    __tablename__ = 'users'

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    role = Column(
            SQLEnum(UserRole, name="user_role") ,
            nullable=False,
            default=UserRole.USER
            )

    last_login_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.now(UTC))
    updated_at = Column(DateTime, default=datetime.now(UTC), onupdate=datetime.now(UTC))

    def __repr__(self):
        return f"<User(user_id={self.user_id}, username={self.username})>"


    def to_dict(self):
        return {
            'user_id': self.user_id,
            'username': self.username,
            'role': self.role,
            'last_login_at': self.last_login_at,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }



