import os
import pandas as pd

from audio_features import extract_audio_features

def process_all_audio(base_path="data/fma_small"):
    all_feature = []

    for folder in os.listdir(base_path):
        folder_path = os.path.join(base_path, folder)
        if not os.path.isdir(folder_path):
            continue

        for file in os.listdir(folder_path):
            if not file.endswith('.mp3'):
                continue

            track_id = int(file.replace('.mp3', ''))
            audio_path = os.path.join(folder_path, file)

            try:
                features = extract_audio_features(audio_path)
                features['track_id'] = track_id
                all_feature.append(features)
                print(f"Processed {track_id}")
            
            except Exception as e:
                print(f"Error processing {track_id}: {e}")

        
    return pd.DataFrame(all_feature)

audio_features_df = process_all_audio()
audio_features_df.to_csv('data/processed/audio_features.csv', index=False)