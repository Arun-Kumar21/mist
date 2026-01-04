from sqlalchemy import Column, Integer, DateTime, ForeignKey, String, Index
from datetime import datetime, UTC
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from db.database import Base


class TrackEmbedding(Base):
    """Store normalized feature vectors using pgvector for similarity search"""
    __tablename__ = 'track_embeddings'
    
    embedding_id = Column(Integer, primary_key=True, autoincrement=True)  
    track_id = Column(Integer, ForeignKey('tracks.track_id', ondelete='CASCADE'), nullable=False)

    # Vector embedding - 40 dimensions
    # 7 spectral + 20 mfcc_means + 3 chroma/harmony + 2 rhythm + 7 energy/texture + 1 mel = 40
    embedding_vector = Column(Vector(40))  
    
    embedding_type = Column(String(50), default='audio_content')
    
    created_at = Column(DateTime, default=datetime.now(UTC))
    
    # Relationship
    track = relationship("Track", back_populates="embeddings")
    
    __table_args__ = (
        Index('ix_embedding_vector_cosine', 'embedding_vector', postgresql_using='ivfflat', 
              postgresql_ops={'embedding_vector': 'vector_cosine_ops'}, postgresql_with={'lists': 100}),
    )
    
    def __repr__(self):
        return f"<TrackEmbedding(track_id={self.track_id}, type='{self.embedding_type}')>"
    
    def to_dict(self):
        """Convert embedding to dictionary for JSON serialization"""
        return {
            'embedding_id': self.embedding_id,
            'track_id': self.track_id,
            'embedding_type': self.embedding_type,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

