from sqlalchemy import Column, Integer, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, UTC
import uuid

from ..database import Base


class ProcessingJob(Base):
    """Track audio processing job status"""
    __tablename__ = 'processing_jobs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False, index=True)
    
    track_id = Column(Integer, ForeignKey('tracks.track_id', ondelete='CASCADE'), nullable=True)
    
    s3_input_key = Column(String(500), nullable=True)
    
    status = Column(String(50), default='pending_upload', nullable=False, index=True)
    
    error_message = Column(Text, nullable=True)
    
    started_at = Column(DateTime, default=datetime.now(UTC))
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now(UTC))
    updated_at = Column(DateTime, default=datetime.now(UTC), onupdate=datetime.now(UTC))
    
    # Relationship
    track = relationship("Track", back_populates="processing_job")
    
    def __repr__(self):
        return f"<ProcessingJob(job_id={self.job_id}, status='{self.status}')>"
    
    def to_dict(self):
        """Convert job to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'job_id': str(self.job_id),
            'track_id': self.track_id,
            's3_input_key': self.s3_input_key,
            'status': self.status,
            'error_message': self.error_message,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }