from sqlalchemy import Column, ForeignKey, Integer, LargeBinary, DateTime
from datetime import datetime, UTC
from sqlalchemy.orm import relationship
from shared.db.database import Base


class TrackEncryptionKeys(Base):
    __tablename__ = 'track_encryption_keys'

    id = Column(Integer, primary_key=True)
    track_id = Column(Integer, ForeignKey('tracks.track_id', ondelete='CASCADE'), nullable=False)
    encryption_key = Column(LargeBinary(16), nullable=False)
    created_at = Column(DateTime, default=datetime.now(UTC))

    track = relationship('Track', back_populates="encryption_keys")

    def get_key_bytes(self) -> bytes:
        return bytes(self.encryption_key)

    def to_dict(self):
        return {
            'id': self.id,
            'track_id': self.track_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
