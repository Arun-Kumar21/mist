from sqlalchemy import Column, ForeignKey, Integer, LargeBinary, DateTime
from datetime import datetime, UTC
from sqlalchemy.orm import relationship
from ..database import Base


class TrackEncryptionKeys(Base):
    """ 
    Store AES encryption keys for HLS encrypted audio streams
    """

    __tablename__ = 'track_encryption_keys'

    id = Column(Integer, primary_key=True)    
    track_id = Column(Integer, ForeignKey('tracks.track_id', ondelete='CASCADE'), nullable=False)

    # AES-128 encryption key (16 bytes) stored as BYTEA
    encryption_key = Column(LargeBinary(16), nullable=False)    

    created_at = Column(DateTime, default=datetime.now(UTC))

    # Relationship
    track = relationship('Track', back_populates="encryption_keys")

    def __repr__(self) -> str:
        return f"<TrackEncryptionKeys(track_id={self.track_id})>"
    
    def to_dict(self, include_key=False):
        """
        Convert to dictionary for JSON serialization.
        
        Args:
            include_key: If True, includes the encryption key (for secure key delivery endpoint).
                        Default False for security - never include in general API responses.
        """
        result = {
            'id': self.id,
            'track_id': self.track_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        
        if include_key and self.encryption_key:
            # For HLS key URI endpoint - return as hex for transport
            result['encryption_key'] = self.encryption_key.hex()
        
        return result
    
    def get_key_bytes(self):
        """Get raw 16-byte encryption key for HLS decryption"""
        return self.encryption_key

