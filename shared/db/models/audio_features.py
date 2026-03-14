from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from datetime import datetime, UTC
from sqlalchemy.orm import relationship
from shared.db.database import Base


class AudioFeatures(Base):
    __tablename__ = 'audio_features'

    feature_id = Column(Integer, primary_key=True, autoincrement=True)
    track_id = Column(Integer, ForeignKey('tracks.track_id', ondelete='CASCADE'), unique=True, nullable=False)

    spectral_centroid = Column(Float)
    spectral_rolloff = Column(Float)
    spectral_bandwidth = Column(Float)

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

    chroma_mean = Column(Float)
    chroma_std = Column(Float)
    tempo = Column(Float)
    beat_strength = Column(Float)
    zcr_mean = Column(Float)
    rms_mean = Column(Float)
    rms_std = Column(Float)
    mel_spec_mean = Column(Float)
    mel_spec_std = Column(Float)
    spectral_contrast_mean = Column(Float)
    spectral_flatness = Column(Float)
    spectral_rolloff_85 = Column(Float)
    spectral_bandwidth_var = Column(Float)
    tonnetz_mean = Column(Float)
    chroma_cens_mean = Column(Float)
    harmonic_mean = Column(Float)
    percussive_mean = Column(Float)
    zcr_var = Column(Float)
    rms_var = Column(Float)

    created_at = Column(DateTime, default=datetime.now(UTC))

    track = relationship("Track", back_populates="audio_features")

    def to_dict(self):
        return {
            'feature_id': self.feature_id,
            'track_id': self.track_id,
            'spectral_centroid': self.spectral_centroid,
            'spectral_rolloff': self.spectral_rolloff,
            'spectral_bandwidth': self.spectral_bandwidth,
            'tempo': self.tempo,
            'beat_strength': self.beat_strength,
            'zcr_mean': self.zcr_mean,
            'rms_mean': self.rms_mean,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
