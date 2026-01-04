from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from datetime import datetime, UTC
from sqlalchemy.orm import relationship
from ..database import Base


class Track(Base):
    """Track model for storing processed audio metadata"""
    __tablename__ = 'tracks'

    track_id = Column(Integer, primary_key=True)
    title = Column(String(500))
    artist_name = Column(String(500)) 
    album_title = Column(String(500))
    genre_top = Column(String(100), index=True)

    # Streaming data
    cdn_url = Column(Text)
    file_size_mb = Column(Float)
    duration_sec = Column(Float) 

    # Original FMA metadata
    listens = Column(Integer)
    interest = Column(Integer)
    date_created = Column(String(50))
    
    processing_status = Column(String(50), default='success')  

    # Relationships
    audio_features = relationship("AudioFeatures", back_populates="track", uselist=False, cascade="all, delete-orphan")
    embeddings = relationship("TrackEmbedding", back_populates="track", cascade="all, delete-orphan")
    processing_job = relationship("ProcessingJob", back_populates="track", uselist=False)
    encryption_keys = relationship("TrackEncryptionKeys", back_populates="track", uselist=False, cascade="all, delete-orphan")

    # Timestamps
    created_at = Column(DateTime, default=datetime.now(UTC))
    updated_at = Column(DateTime, default=datetime.now(UTC), onupdate=datetime.now(UTC))

    def __repr__(self):
        return f"<Track(id={self.track_id}, title='{self.title}', artist='{self.artist_name}')>"
    
    def to_dict(self):
        """Convert track to dictionary for JSON serialization"""
        return {
            'track_id': self.track_id,
            'title': self.title,
            'artist_name': self.artist_name,
            'album_title': self.album_title,
            'genre_top': self.genre_top,
            'cdn_url': self.cdn_url,
            'file_size_mb': self.file_size_mb,
            'duration_sec': self.duration_sec,
            'listens': self.listens,
            'interest': self.interest,
            'date_created': self.date_created,
            'processing_status': self.processing_status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

