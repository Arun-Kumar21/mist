# User Embedding + Collaborative Filtering (Feed) - Implementation Notes

## Overview
This document explains how the personalized feed is generated in MIST using a hybrid approach:

1. User preference signals (liked songs)
2. User behavior signals (listening count and duration)
3. Embedding similarity (cosine distance between track vectors)
4. Popularity fallback for cold or sparse profiles

The feed endpoint is implemented at:
- `GET /api/v1/library/feed`

## Why This Is Hybrid Collaborative Filtering
The current system is not pure matrix factorization. It is a practical hybrid:

- Item-item collaborative behavior:
  - Uses songs the user liked and listened to as "seed" items.
  - Uses aggregate listening behavior (play_count and total_duration) to weight seeds.

- Content/embedding similarity:
  - For each seed, nearest-neighbor tracks are found using embedding cosine distance.

- Global fallback:
  - If recommendation depth is not enough, the system backfills with most-listened tracks.

This gives strong quality for active users while staying robust for low-data users.

## Data Sources

### 1) Likes
From `TrackLikeRepository.get_liked_tracks(user_id, limit, offset)`:
- Returns rows shaped like:
  - `{ "liked_at": ..., "track": { ...track fields... } }`

### 2) Listening history
From `ListeningHistoryRepository.get_user_top_tracks(user_id, limit)`:
- Aggregates by track and returns:
  - `track`
  - `play_count`
  - `total_duration`

### 3) Similar tracks via embeddings
From `TrackEmbeddingRepository.find_similar_tracks(track_id, limit)`:
- Uses `embedding_vector.cosine_distance(target_embedding.embedding_vector)`
- Returns `(track, distance)` pairs ordered by nearest distance first.

## End-to-End Feed Pipeline
Implemented in `api-service/routes/library.py` inside `get_personalized_feed`.

### Step 1: Build seed set
- Pull latest liked tracks (up to 12)
- Pull top listened tracks (up to 8)
- Keep seed metadata in a dictionary keyed by `track_id`

Each seed has:
- `track`
- cumulative `weight`
- source tags (`liked`, `listened`)

### Step 2: Assign seed weights
Liked tracks weight:
- Newer likes get higher weight
- Formula in code:
  - `2.4 - min(index, 10) * 0.08`

Listened tracks weight:
- Combines frequency and engagement duration
- Formula in code:
  - `1.0 + min(play_count, 8) * 0.35 + min(total_duration / 300.0, 1.5)`

Interpretation:
- More replays and longer listening increase seed influence
- Capped terms avoid runaway dominance

### Step 3: Expand candidates using embedding neighbors
For each seed:
- Get nearest tracks from embeddings
- Skip tracks that are already seed tracks
- Convert distance to similarity:
  - `similarity = max(0.0, 1.0 - distance)`
- Ignore very weak neighbors:
  - skip if similarity <= 0.05

### Step 4: Score candidate tracks
Per seed-neighbor contribution:
- `popularity_bonus = min(listens / 1000.0, 5.0)`
- `score = seed_weight * (similarity * 100.0) + popularity_bonus`

Candidate accumulates score from multiple seeds.

Also tracked per candidate:
- `seed_track_ids` used to justify recommendation
- textual `reasons`:
  - "based on songs you liked"
  - "based on your listening history"

### Step 5: Rank and finalize
- Sort candidates by descending score
- Exclude duplicates and seed tracks
- Return up to requested `limit`

### Step 6: Popularity fallback
If still short of requested limit:
- Pull most-listened tracks from `AnalyticsRepository.get_most_listened_tracks`
- Add unseen tracks with neutral recommendation score and reason:
  - "popular with listeners"

## API Response Shape
`GET /api/v1/library/feed?limit=24`
returns:

- `success`
- `liked_seed_tracks`
- `listened_seed_tracks`
- `recommendations`
- `count`

Each recommendation includes:
- base track fields
- `recommendation_score`
- `based_on_track_ids`
- `reasons`

## Core Code References

- Feed endpoint logic:
  - `api-service/routes/library.py` -> `get_personalized_feed`

- Listening aggregation:
  - `shared/db/controllers/listening_history_controller.py` -> `get_user_top_tracks`

- Embedding nearest neighbors:
  - `shared/db/controllers/track_embedding_controller.py` -> `find_similar_tracks`

- Likes source:
  - `shared/db/controllers/track_like_controller.py` -> `get_liked_tracks`

## Design Notes and Tradeoffs

### Strengths
- Explainable recommendations (`reasons`, `based_on_track_ids`)
- Uses both explicit and implicit user feedback
- Works even with sparse user data due to fallback
- Fast to iterate by tuning a few constants

### Current Limitations
- No time decay for very old listening events (yet)
- No explicit diversity/novelty re-ranking (yet)
- Seed caps are static
- Popularity fallback can bias toward head tracks if user profile is sparse

## Tuning Parameters (Current)
- Likes seed count: 12
- Listening seed count: 8
- Similar neighbors per seed: `min(max(limit // 2, 6), 12)`
- Similarity threshold: 0.05
- Popularity bonus cap: 5.0

These are straightforward to tune without changing architecture.

## Suggested Next Improvements
1. Add recency decay to listening signals
2. Add diversity penalty so recommendations are not too similar to each other
3. Add genre/artist balancing for exploration
4. Add online feedback loop (skip rate / completion rate) into scoring
5. Store and expose explanation confidence per recommendation

## Minimal Pseudocode

```python
seeds = build_seeds_from_likes_and_listening(user)
for seed in seeds:
    for neighbor in embedding_neighbors(seed.track_id):
        if neighbor is seed: continue
        similarity = 1 - distance
        if similarity <= threshold: continue
        score += seed.weight * similarity_scale + popularity_bonus
ranked = sort_by_score(candidates)
if ranked too short:
    ranked += most_listened_fallback
return ranked[:limit]
```

This is the implementation model currently running in the codebase.
