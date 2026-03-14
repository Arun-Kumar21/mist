import librosa
import numpy as np


def extract_audio_features(audio_path, sr=22050, duration=30):
    y, sr = librosa.load(audio_path, sr=sr, duration=duration)
    track_duration = librosa.get_duration(y=y, sr=sr)

    features = {'duration': float(track_duration)}

    features['spectral_centroid'] = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
    features['spectral_rolloff'] = np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr))
    features['spectral_bandwidth'] = np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr))

    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    for i in range(20):
        features[f'mfcc_{i}_mean'] = np.mean(mfccs[i])
        features[f'mfcc_{i}_std'] = np.std(mfccs[i])

    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    features['chroma_mean'] = np.mean(chroma)
    features['chroma_std'] = np.std(chroma)

    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    features['tempo'] = float(tempo) if tempo else 120.0
    features['beat_strength'] = np.mean(librosa.onset.onset_strength(y=y, sr=sr))

    zcr = librosa.feature.zero_crossing_rate(y)
    features['zcr_mean'] = np.mean(zcr)
    features['zcr_var'] = np.var(zcr)

    rms = librosa.feature.rms(y=y)
    features['rms_mean'] = np.mean(rms)
    features['rms_std'] = np.std(rms)
    features['rms_var'] = np.var(rms)

    mel_spec = librosa.feature.melspectrogram(y=y, sr=sr)
    features['mel_spec_mean'] = np.mean(mel_spec)
    features['mel_spec_std'] = np.std(mel_spec)

    features['spectral_contrast_mean'] = np.mean(librosa.feature.spectral_contrast(y=y, sr=sr))
    features['spectral_flatness'] = np.mean(librosa.feature.spectral_flatness(y=y))

    rolloff_85 = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)
    features['spectral_rolloff_85'] = np.mean(rolloff_85)
    features['spectral_bandwidth_var'] = np.var(librosa.feature.spectral_bandwidth(y=y, sr=sr))

    y_harmonic = librosa.effects.harmonic(y)
    features['tonnetz_mean'] = np.mean(librosa.feature.tonnetz(y=y_harmonic, sr=sr))

    chroma_cens = librosa.feature.chroma_cens(y=y_harmonic, sr=sr)
    features['chroma_cens_mean'] = np.mean(chroma_cens)

    y_harmonic2, y_percussive = librosa.effects.hpss(y)
    features['harmonic_mean'] = np.mean(np.abs(y_harmonic2))
    features['percussive_mean'] = np.mean(np.abs(y_percussive))

    return features
