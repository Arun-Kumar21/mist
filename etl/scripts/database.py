import os 
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.pool import NullPool
from datetime import datetime, UTC
from dotenv import load_dotenv
from pgvector.sqlalchemy import Vector

load_dotenv()

Base = declarative_base()

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

    # Timestamps
    created_at = Column(DateTime, default=datetime.now(UTC))
    updated_at = Column(DateTime, default=datetime.now(UTC), onupdate=datetime.now(UTC))

    def __repr__(self):
        return f"<Track(id={self.track_id}, title='{self.title}', artist='{self.artist_name}')>"


class AudioFeatures(Base):
    """Store all raw extracted audio features - for analysis and reprocessing"""
    __tablename__ = 'audio_features'

    feature_id = Column(Integer, primary_key=True, autoincrement=True)  
    track_id = Column(Integer, ForeignKey('tracks.track_id', ondelete='CASCADE'), unique=True, nullable=False)  # Changed to nullable=False

    # Spectral features (3)
    spectral_centroid = Column(Float)
    spectral_rolloff = Column(Float)
    spectral_bandwidth = Column(Float)
    
    # MFCCs - Mean values (20 coefficients)
    mfcc_0_mean = Column(Float)
    mfcc_1_mean = Column(Float)
    mfcc_2_mean = Column(Float)
    mfcc_3_mean = Column(Float)
    mfcc_4_mean = Column(Float)
    mfcc_5_mean = Column(Float)
    mfcc_6_mean = Column(Float)
    mfcc_7_mean = Column(Float)
    mfcc_8_mean = Column(Float)
    mfcc_9_mean = Column(Float)
    mfcc_10_mean = Column(Float)
    mfcc_11_mean = Column(Float)
    mfcc_12_mean = Column(Float)
    mfcc_13_mean = Column(Float)
    mfcc_14_mean = Column(Float)
    mfcc_15_mean = Column(Float)
    mfcc_16_mean = Column(Float)
    mfcc_17_mean = Column(Float)
    mfcc_18_mean = Column(Float)
    mfcc_19_mean = Column(Float)
    
    # MFCCs - Standard deviation values (20)
    mfcc_0_std = Column(Float)
    mfcc_1_std = Column(Float)
    mfcc_2_std = Column(Float)
    mfcc_3_std = Column(Float)
    mfcc_4_std = Column(Float)
    mfcc_5_std = Column(Float)
    mfcc_6_std = Column(Float)
    mfcc_7_std = Column(Float)
    mfcc_8_std = Column(Float)
    mfcc_9_std = Column(Float)
    mfcc_10_std = Column(Float)
    mfcc_11_std = Column(Float)
    mfcc_12_std = Column(Float)
    mfcc_13_std = Column(Float)
    mfcc_14_std = Column(Float)
    mfcc_15_std = Column(Float)
    mfcc_16_std = Column(Float)
    mfcc_17_std = Column(Float)
    mfcc_18_std = Column(Float)
    mfcc_19_std = Column(Float)
    
    # Chroma features (2)
    chroma_mean = Column(Float)
    chroma_std = Column(Float)
    
    # Rhythm features (2)
    tempo = Column(Float)
    beat_strength = Column(Float)
    
    # Texture and energy (3)
    zcr_mean = Column(Float)
    rms_mean = Column(Float)
    rms_std = Column(Float)
    
    # Mel spectrogram (2)
    mel_spec_mean = Column(Float)
    mel_spec_std = Column(Float)
    
    # Spectral features
    spectral_contrast_mean = Column(Float)
    spectral_flatness = Column(Float)
    spectral_rolloff_85 = Column(Float)
    spectral_bandwidth_var = Column(Float)
    
    # Harmonic/Tonal features
    tonnetz_mean = Column(Float)
    chroma_cens_mean = Column(Float)
    
    # Harmonic/Percussive separation
    harmonic_mean = Column(Float)
    percussive_mean = Column(Float)
    
    # Variance features
    zcr_var = Column(Float)
    rms_var = Column(Float)
    
    created_at = Column(DateTime, default=datetime.now(UTC))
    
    # Relationship
    track = relationship("Track", back_populates="audio_features")
    
    def __repr__(self):
        return f"<AudioFeatures(track_id={self.track_id})>"


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


class DatabaseManager:
    """Manages database connections and operations""" 

    def __init__(self, database_url=None):
        self.database_url = database_url or os.getenv('DATABASE_URL')
        if not self.database_url:
            raise ValueError("DATABASE_URL not found in environment variables") 
        
        self.engine = create_engine(
            self.database_url,
            poolclass=NullPool,
            echo=False
        )

        self.SessionLocal = sessionmaker(bind=self.engine)

    def create_tables(self):
        """Create all tables in the database"""
        Base.metadata.create_all(self.engine)
        print("Database tables created successfully")
        print("Tables: tracks, audio_features, track_embeddings")  

    def drop_tables(self):
        """Drop all tables (use with caution!)"""
        Base.metadata.drop_all(self.engine)
        print("Database tables dropped")

    def get_session(self):
        """Get a new database session"""
        return self.SessionLocal()

    # ============= TRACK =============

    def insert_track(self, track_data):
        """Insert a single track record"""
        session = self.get_session()
        try:
            track = Track(**track_data)
            session.add(track)
            session.commit()
            return track.track_id
        except Exception as e:
            session.rollback()
            print(f"Error inserting track: {e}")
            raise  # Added raise
        finally:
            session.close()

    def bulk_insert_tracks(self, tracks_data):
        """Bulk insert multiple tracks"""
        session = self.get_session()
        try:
            tracks = [Track(**track_data) for track_data in tracks_data]
            session.bulk_save_objects(tracks)
            session.commit()
            print(f"Successfully inserted {len(tracks)} tracks")
        except Exception as e:
            session.rollback()
            print(f"Error bulk inserting tracks: {e}")
            raise
        finally:
            session.close()

    def update_track(self, track_id, update_data):
        """Update a track by ID"""
        session = self.get_session()
        try:
            track = session.query(Track).filter(Track.track_id == track_id).first()
            if track:
                for key, value in update_data.items():
                    setattr(track, key, value)
                track.updated_at = datetime.now(UTC)  
                session.commit()
                return True
            return False
        except Exception as e:
            session.rollback()
            print(f"Error updating track {track_id}: {e}")
            raise
        finally:
            session.close()

    def get_track(self, track_id):
        """Get a single track by ID"""
        session = self.get_session()
        try:
            return session.query(Track).filter(Track.track_id == track_id).first()
        finally:
            session.close()

    def get_all_tracks(self, limit=None, offset=0):
        """Get all tracks with optional pagination"""
        session = self.get_session()
        try:
            query = session.query(Track).offset(offset)
            if limit:
                query = query.limit(limit)
            return query.all()
        finally:
            session.close()

    def get_tracks_by_genre(self, genre, limit=None):
        """Get tracks by genre"""
        session = self.get_session()
        try:
            query = session.query(Track).filter(Track.genre_top == genre)
            if limit:
                query = query.limit(limit)
            return query.all()
        finally:
            session.close()
    
    def search_tracks(self, search_term, limit=20):
        """Search tracks by title or artist name"""
        session = self.get_session()
        try:
            return session.query(Track).filter(
                (Track.title.ilike(f'%{search_term}%')) |
                (Track.artist_name.ilike(f'%{search_term}%'))
            ).limit(limit).all()
        finally:
            session.close()

    def get_track_count(self):
        """Get total number of tracks"""
        session = self.get_session()
        try:
            return session.query(Track).count()
        finally:
            session.close()

    # ============= AUDIO FEATURES =============
    
    def insert_audio_features(self, features_data):
        """Insert audio features for a track"""
        session = self.get_session()
        try:
            features = AudioFeatures(**features_data)
            session.add(features)
            session.commit()
            return features.feature_id
        except Exception as e:
            session.rollback()
            print(f"Error inserting audio features: {e}")
            raise
        finally:
            session.close()
    
    def bulk_insert_audio_features(self, features_data_list):
        """Bulk insert audio features"""
        session = self.get_session()
        try:
            features = [AudioFeatures(**data) for data in features_data_list]
            session.bulk_save_objects(features)
            session.commit()
            print(f"Successfully inserted {len(features)} audio features")
        except Exception as e:
            session.rollback()
            print(f"Error bulk inserting audio features: {e}")
            raise
        finally:
            session.close()
    
    def get_audio_features(self, track_id):
        """Get audio features for a specific track"""
        session = self.get_session()
        try:
            return session.query(AudioFeatures).filter(AudioFeatures.track_id == track_id).first()
        finally:
            session.close()

    # ============= EMBEDDING =============
    
    def insert_embedding(self, embedding_data):
        """Insert a track embedding"""
        session = self.get_session()
        try:
            embedding = TrackEmbedding(**embedding_data)
            session.add(embedding)
            session.commit()
            return embedding.embedding_id
        except Exception as e:
            session.rollback()
            print(f"Error inserting embedding: {e}")
            raise
        finally:
            session.close()
    
    def bulk_insert_embeddings(self, embeddings_data_list):
        """Bulk insert embeddings"""
        session = self.get_session()
        try:
            embeddings = [TrackEmbedding(**data) for data in embeddings_data_list]
            session.bulk_save_objects(embeddings)
            session.commit()
            print(f"Successfully inserted {len(embeddings)} embeddings")
        except Exception as e:
            session.rollback()
            print(f"Error bulk inserting embeddings: {e}")
            raise
        finally:
            session.close()
    
    def find_similar_tracks(self, track_id, limit=10):
        """Find similar tracks using vector similarity (cosine distance)"""
        session = self.get_session()
        try:
            # Get the target track's embedding
            target_embedding = session.query(TrackEmbedding).filter(
                TrackEmbedding.track_id == track_id
            ).first()
            
            if not target_embedding:
                return []
            
            # Find similar tracks using cosine distance (<=> operator in pgvector)
            similar = session.query(
                Track,
                TrackEmbedding.embedding_vector.cosine_distance(target_embedding.embedding_vector).label('distance')
            ).join(TrackEmbedding).filter(
                Track.track_id != track_id
            ).order_by('distance').limit(limit).all()
            
            return [(track, float(distance)) for track, distance in similar]
        finally:
            session.close()
    
    def get_embedding(self, track_id):
        """Get embedding for a specific track"""
        session = self.get_session()
        try:
            return session.query(TrackEmbedding).filter(TrackEmbedding.track_id == track_id).first()
        finally:
            session.close()


def init_database():
    """Initialize database with tables"""
    db = DatabaseManager()
    db.create_tables()
    print("Database initialized successfully")
    return db


if __name__ == "__main__":
    init_database()