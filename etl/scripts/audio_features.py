import librosa
import numpy as np

def extract_audio_features(audio_path, sr=22050, duration=30):
    y, sr = librosa.load(audio_path, sr=sr, duration=duration)

    features = {}

    # Spectral features
    features['spectral_centroid'] = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
    features['spectral_rolloff'] = np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr))
    features['spectral_bandwidth'] = np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr))
    

    # MFCCs 
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    for i in range(20):
        features[f'mfcc_{i}_mean'] = np.mean(mfccs[i])
        features[f'mfcc_{i}_std'] = np.std(mfccs[i])

    # Chroma
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    features['chroma_mean'] = np.mean(chroma)
    features['chroma_std'] = np.std(chroma)

    # 4. Tempo and Beat
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    features['tempo'] = tempo
    features['beat_strength'] = np.mean(librosa.onset.onset_strength(y=y, sr=sr))
    
    # 5. Zero Crossing Rate (texture)
    features['zcr_mean'] = np.mean(librosa.feature.zero_crossing_rate(y))
    
    # 6. RMS Energy (loudness)
    features['rms_mean'] = np.mean(librosa.feature.rms(y=y))
    features['rms_std'] = np.std(librosa.feature.rms(y=y))
    
    # 7. Mel Spectrogram
    mel_spec = librosa.feature.melspectrogram(y=y, sr=sr)
    features['mel_spec_mean'] = np.mean(mel_spec)
    features['mel_spec_std'] = np.std(mel_spec)
    
    return features