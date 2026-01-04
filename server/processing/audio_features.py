import librosa
import numpy as np

def extract_audio_features(audio_path, sr=22050, duration=30):
    y, sr = librosa.load(audio_path, sr=sr, duration=duration)
    
    track_duration = librosa.get_duration(y=y, sr=sr)

    features = {}
    features['duration'] = float(track_duration)
    
    # Spectral features (3)
    features['spectral_centroid'] = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
    features['spectral_rolloff'] = np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr))
    features['spectral_bandwidth'] = np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr))

    # MFCCs (40: 20 means + 20 stds)
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    for i in range(20):
        features[f'mfcc_{i}_mean'] = np.mean(mfccs[i])
        features[f'mfcc_{i}_std'] = np.std(mfccs[i])

    # Chroma (2)
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    features['chroma_mean'] = np.mean(chroma)
    features['chroma_std'] = np.std(chroma)

    # Tempo and Beat (2)
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    features['tempo'] = float(tempo) if tempo else 120.0
    features['beat_strength'] = np.mean(librosa.onset.onset_strength(y=y, sr=sr))
    
    # Zero Crossing Rate (1)
    zcr = librosa.feature.zero_crossing_rate(y)
    features['zcr_mean'] = np.mean(zcr)
    
    # RMS Energy (2)
    rms = librosa.feature.rms(y=y)
    features['rms_mean'] = np.mean(rms)
    features['rms_std'] = np.std(rms)
    
    # Mel Spectrogram (2)
    mel_spec = librosa.feature.melspectrogram(y=y, sr=sr)
    features['mel_spec_mean'] = np.mean(mel_spec)
    features['mel_spec_std'] = np.std(mel_spec)
    
    
    # Spectral Contrast - VERY IMPORTANT for timbre differentiation
    spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
    features['spectral_contrast_mean'] = np.mean(spectral_contrast)
    
    # Spectral Flatness - Distinguishes tonal vs noisy sounds
    features['spectral_flatness'] = np.mean(librosa.feature.spectral_flatness(y=y))
    
    # Tonnetz - Harmonic content (chord progressions, tonality)
    y_harmonic = librosa.effects.harmonic(y)
    tonnetz = librosa.feature.tonnetz(y=y_harmonic, sr=sr)
    features['tonnetz_mean'] = np.mean(tonnetz)
    
    # Harmonic/Percussive Separation - Melody vs rhythm
    y_harmonic, y_percussive = librosa.effects.hpss(y)
    features['harmonic_mean'] = np.mean(np.abs(y_harmonic))
    features['percussive_mean'] = np.mean(np.abs(y_percussive))
    
    # Chroma CENS - Better energy-normalized chroma
    chroma_cens = librosa.feature.chroma_cens(y=y, sr=sr)
    features['chroma_cens_mean'] = np.mean(chroma_cens)
    
    # Zero Crossing Rate variance - Texture variability
    features['zcr_var'] = np.var(zcr)
    
    # RMS variance - Energy dynamics
    features['rms_var'] = np.var(rms)
    
    # Spectral Bandwidth variance - Frequency spread changes
    spectral_bw = librosa.feature.spectral_bandwidth(y=y, sr=sr)
    features['spectral_bandwidth_var'] = np.var(spectral_bw)
    
    # Spectral Rolloff 85% - Alternative rolloff point
    features['spectral_rolloff_85'] = np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85))
    
    for key, value in features.items():
        if isinstance(value, (np.integer, np.floating)):
            features[key] = float(value)
    
    return features