import numpy as np


def select_embedding_features(features_dict):
    mfcc_mean_features = [f'mfcc_{i}_mean' for i in range(20)] 
    embeddings_features = [
        'spectral_centroid', 'spectral_rolloff', 'spectral_bandwidth',
        'spectral_contrast_mean', 'spectral_flatness', 'spectral_rolloff_85',
        'spectral_bandwidth_var', 'chroma_mean', 'tonnetz_mean',
        'chroma_cens_mean', 'tempo', 'beat_strength', 'rms_mean',
        'rms_std', 'rms_var', 'zcr_mean', 'zcr_var', 'harmonic_mean',
        'percussive_mean', 'mel_spec_mean'
    ] + mfcc_mean_features

    return [float(features_dict.get(k, 0.0) or 0.0) for k in embeddings_features]


def normalize_embeddings(embeddings):  
    eps = 1e-12
    v = np.array(embeddings, dtype = float)
    norm = np.linalg.norm(v)
    if norm <= eps:
        return v  
    return v / norm

def create_embedding_vector(features_dict):
    embeddings = select_embedding_features(features_dict)

    embedding_vector = normalize_embeddings(embeddings)

    return embedding_vector
