import uuid
from datetime import datetime, UTC
from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from shared.db.database import Base


class Playlist(Base):
    __tablename__ = 'playlists'

    playlist_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    description = Column(String(500), nullable=True)
    is_public = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.now(UTC))
    updated_at = Column(DateTime, default=datetime.now(UTC), onupdate=datetime.now(UTC))

    def to_dict(self):
        return {
            'playlist_id': str(self.playlist_id),
            'user_id': str(self.user_id),
            'name': self.name,
            'description': self.description,
            'is_public': self.is_public,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class PlaylistTrack(Base):
    __tablename__ = 'playlist_tracks'

    id = Column(Integer, primary_key=True)
    playlist_id = Column(UUID(as_uuid=True), ForeignKey('playlists.playlist_id', ondelete='CASCADE'), nullable=False, index=True)
    track_id = Column(Integer, ForeignKey('tracks.track_id', ondelete='CASCADE'), nullable=False, index=True)
    position = Column(Integer, default=0, nullable=False)
    added_at = Column(DateTime, default=datetime.now(UTC))

    __table_args__ = (
        UniqueConstraint('playlist_id', 'track_id', name='uq_playlist_track_pair'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'playlist_id': str(self.playlist_id),
            'track_id': self.track_id,
            'position': self.position,
            'added_at': self.added_at.isoformat() if self.added_at else None,
        }
