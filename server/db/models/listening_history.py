from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from datetime import datetime, UTC
import uuid

from db.database import Base


class UserListeningHistory(Base):
    __tablename__ = "user_listening_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    track_id = Column(Integer, ForeignKey("tracks.track_id"), nullable=False)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    duration_listened = Column(Float, default=0.0)
    completed = Column(Boolean, default=False)
    ip_address = Column(String(45), nullable=False)
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": str(self.user_id) if self.user_id else None,
            "track_id": self.track_id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "duration_listened": self.duration_listened,
            "completed": self.completed,
            "ip_address": self.ip_address
        }


class DailyListenQuota(Base):
    __tablename__ = "daily_listen_quota"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    date = Column(DateTime(timezone=True), nullable=False)
    minutes_listened = Column(Float, default=0.0)
    tracks_started = Column(Integer, default=0)
    tracks_completed = Column(Integer, default=0)
    ip_address = Column(String(45), nullable=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": str(self.user_id) if self.user_id else None,
            "date": self.date.isoformat() if self.date else None,
            "minutes_listened": self.minutes_listened,
            "tracks_started": self.tracks_started,
            "tracks_completed": self.tracks_completed,
            "ip_address": self.ip_address
        }
