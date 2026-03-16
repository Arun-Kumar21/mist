from datetime import datetime, UTC
from sqlalchemy import Column, Integer, DateTime, Boolean, ForeignKey, UniqueConstraint
from shared.db.database import Base


class AdminCuratedTrack(Base):
    __tablename__ = 'admin_curated_tracks'

    id = Column(Integer, primary_key=True)
    track_id = Column(Integer, ForeignKey('tracks.track_id', ondelete='CASCADE'), nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.now(UTC))
    updated_at = Column(DateTime, default=datetime.now(UTC), onupdate=datetime.now(UTC))

    __table_args__ = (
        UniqueConstraint('track_id', name='uq_admin_curated_track_track_id'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'track_id': self.track_id,
            'display_order': self.display_order,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
