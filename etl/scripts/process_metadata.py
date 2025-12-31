import pandas as pd
import numpy as np

# load metadata

tracks = pd.read_csv('data/fma_metadata/tracks.csv', index_col=0, header=[0, 1])
genres = pd.read_csv('data/fma_metadata/genres.csv', index_col=0)
features = pd.read_csv('data/fma_metadata/features.csv', index_col=0, header=[0, 1, 2])

tracks_small = tracks[tracks['set', 'subset'] <= 'small']

tracks_data = pd.DataFrame({
    'track_id': tracks_small.index,
    'title': tracks_small['track', 'title'],
    'artist_name': tracks_small['artist', 'name'],
    'album_title': tracks_small['album', 'title'],
    'genre_top': tracks_small['track', 'genre_top'],
    'duration': tracks_small['track', 'duration'],
    'bit_rate': tracks_small['track', 'bit_rate'],
    'listens': tracks_small['track', 'listens'],
    'interest': tracks_small['track', 'interest'],
    'data_created': tracks_small['track', 'date_created']
})


#print(tracks_data.head(5))