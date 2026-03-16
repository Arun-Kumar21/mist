from datetime import datetime, UTC
from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from shared.db.database import Base


class TrackLike(Base):
    __tablename__ = 'track_likes'

    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False, index=True)
    track_id = Column(Integer, ForeignKey('tracks.track_id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.now(UTC))

    __table_args__ = (
        UniqueConstraint('user_id', 'track_id', name='uq_track_likes_user_track'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': str(self.user_id),
            'track_id': self.track_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
