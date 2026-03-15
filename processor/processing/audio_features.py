import librosa
import numpy as np


def _to_float(value, default=0.0):
    """Safely coerce librosa/numpy outputs into plain Python float values."""
    if value is None:
        return float(default)

    if np.isscalar(value):
        return float(value)

    arr = np.asarray(value)
    if arr.size == 0:
        return float(default)

    # For non-scalar arrays, use the mean value to get a stable numeric scalar.
    return float(np.mean(arr))


def extract_audio_features(audio_path, sr=22050, duration=30):
    y, sr = librosa.load(audio_path, sr=sr, duration=duration)
    track_duration = librosa.get_duration(y=y, sr=sr)

    features = {'duration': _to_float(track_duration)}

    features['spectral_centroid'] = _to_float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    features['spectral_rolloff'] = _to_float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
    features['spectral_bandwidth'] = _to_float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)))

    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    for i in range(20):
        features[f'mfcc_{i}_mean'] = _to_float(np.mean(mfccs[i]))
        features[f'mfcc_{i}_std'] = _to_float(np.std(mfccs[i]))

    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    features['chroma_mean'] = _to_float(np.mean(chroma))
    features['chroma_std'] = _to_float(np.std(chroma))

    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    features['tempo'] = _to_float(tempo, default=120.0)
    features['beat_strength'] = _to_float(np.mean(librosa.onset.onset_strength(y=y, sr=sr)))

    zcr = librosa.feature.zero_crossing_rate(y)
    features['zcr_mean'] = _to_float(np.mean(zcr))
    features['zcr_var'] = _to_float(np.var(zcr))

    rms = librosa.feature.rms(y=y)
    features['rms_mean'] = _to_float(np.mean(rms))
    features['rms_std'] = _to_float(np.std(rms))
    features['rms_var'] = _to_float(np.var(rms))

    mel_spec = librosa.feature.melspectrogram(y=y, sr=sr)
    features['mel_spec_mean'] = _to_float(np.mean(mel_spec))
    features['mel_spec_std'] = _to_float(np.std(mel_spec))

    features['spectral_contrast_mean'] = _to_float(np.mean(librosa.feature.spectral_contrast(y=y, sr=sr)))
    features['spectral_flatness'] = _to_float(np.mean(librosa.feature.spectral_flatness(y=y)))

    rolloff_85 = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)
    features['spectral_rolloff_85'] = _to_float(np.mean(rolloff_85))
    features['spectral_bandwidth_var'] = _to_float(np.var(librosa.feature.spectral_bandwidth(y=y, sr=sr)))

    y_harmonic = librosa.effects.harmonic(y)
    features['tonnetz_mean'] = _to_float(np.mean(librosa.feature.tonnetz(y=y_harmonic, sr=sr)))

    chroma_cens = librosa.feature.chroma_cens(y=y_harmonic, sr=sr)
    features['chroma_cens_mean'] = _to_float(np.mean(chroma_cens))

    y_harmonic2, y_percussive = librosa.effects.hpss(y)
    features['harmonic_mean'] = _to_float(np.mean(np.abs(y_harmonic2)))
    features['percussive_mean'] = _to_float(np.mean(np.abs(y_percussive)))

    return features
