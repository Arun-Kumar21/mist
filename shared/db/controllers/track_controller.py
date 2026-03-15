from datetime import datetime, UTC
from sqlalchemy import or_, desc
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import Optional, List, Dict, Any
from difflib import SequenceMatcher
import logging

from shared.db.models.tracks import Track
from shared.db.database import get_db_session

logger = logging.getLogger(__name__)


class TrackRepository:

    @staticmethod
    def _normalize_text(value: Optional[str]) -> str:
        if not value:
            return ""
        return " ".join(value.lower().strip().split())

    @staticmethod
    def _search_score(track: Track, query: str, query_tokens: List[str]) -> float:
        title = TrackRepository._normalize_text(track.title)
        artist = TrackRepository._normalize_text(track.artist_name)
        genre = TrackRepository._normalize_text(track.genre_top)
        combined = f"{title} {artist} {genre}".strip()

        if not combined:
            return 0.0

        score = 0.0

        if query in title:
            score += 120
        if query in artist:
            score += 100
        if query in genre:
            score += 115
        if query in combined:
            score += 70

        for token in query_tokens:
            if token in title:
                score += 22
            if token in artist:
                score += 20
            if token in genre:
                score += 24

        max_ratio = max(
            SequenceMatcher(None, query, title).ratio() if title else 0.0,
            SequenceMatcher(None, query, artist).ratio() if artist else 0.0,
            SequenceMatcher(None, query, genre).ratio() if genre else 0.0,
            SequenceMatcher(None, query, combined).ratio(),
        )
        score += max_ratio * 80

        listens = track.listens or 0
        score += min(listens, 500000) / 500000 * 8

        return score

    @staticmethod
    def create(track_data: Dict[str, Any]) -> Optional[int]:
        try:
            with get_db_session() as session:
                track = Track(**track_data)
                session.add(track)
                session.flush()
                track_id = track.track_id
                logger.info(f"Created track {track_id}: {track_data.get('title')}")
                return track_id
        except IntegrityError as e:
            logger.error(f"Integrity error creating track: {e}")
            raise
        except SQLAlchemyError as e:
            logger.error(f"Database error creating track: {e}")
            raise

    @staticmethod
    def get_by_id(track_id: int) -> Optional[Track]:
        try:
            with get_db_session() as session:
                track = session.query(Track).filter(Track.track_id == track_id).first()
                if track:
                    _ = (track.track_id, track.title, track.artist_name, track.album_title,
                         track.genre_top, track.duration_sec, track.cdn_url,
                         track.created_at, track.updated_at)
                    session.expunge(track)
                return track
        except SQLAlchemyError as e:
            logger.error(f"Error fetching track {track_id}: {e}")
            raise

    @staticmethod
    def get_all(limit: int = 20, offset: int = 0) -> List[Track]:
        try:
            with get_db_session() as session:
                tracks = session.query(Track).offset(offset).limit(limit).all()
                for track in tracks:
                    session.expunge(track)
                return tracks
        except SQLAlchemyError as e:
            logger.error(f"Error fetching tracks: {e}")
            raise

    @staticmethod
    def filter_by_genre(genre: str, limit: int = 20, offset: int = 0) -> List[Track]:
        try:
            with get_db_session() as session:
                tracks = session.query(Track).filter(
                    Track.genre_top == genre
                ).offset(offset).limit(limit).all()
                for track in tracks:
                    session.expunge(track)
                return tracks
        except SQLAlchemyError as e:
            logger.error(f"Error fetching tracks by genre {genre}: {e}")
            raise

    @staticmethod
    def search(search_term: str, limit: int = 20) -> List[Track]:
        try:
            normalized_query = TrackRepository._normalize_text(search_term)
            if not normalized_query:
                return []

            query_tokens = [t for t in normalized_query.split(" ") if len(t) >= 2]
            candidate_limit = max(limit * 20, 200)

            with get_db_session() as session:
                filters = [
                    Track.title.ilike(f"%{normalized_query}%"),
                    Track.artist_name.ilike(f"%{normalized_query}%"),
                    Track.genre_top.ilike(f"%{normalized_query}%"),
                ]

                for token in query_tokens:
                    filters.extend([
                        Track.title.ilike(f"%{token}%"),
                        Track.artist_name.ilike(f"%{token}%"),
                        Track.genre_top.ilike(f"%{token}%"),
                    ])

                candidates = session.query(Track).filter(
                    or_(*filters)
                ).order_by(desc(Track.listens), desc(Track.track_id)).limit(candidate_limit).all()

                # If strict token/substring matching found little, pull broader candidates
                # and rely on fuzzy scoring to return likely typo matches.
                if len(candidates) < limit:
                    broader = session.query(Track).filter(
                        or_(
                            Track.title.isnot(None),
                            Track.artist_name.isnot(None),
                            Track.genre_top.isnot(None),
                        )
                    ).order_by(desc(Track.listens), desc(Track.track_id)).limit(candidate_limit).all()
                    by_id = {track.track_id: track for track in candidates}
                    for track in broader:
                        by_id.setdefault(track.track_id, track)
                    candidates = list(by_id.values())

                score_by_id = {
                    track.track_id: TrackRepository._search_score(track, normalized_query, query_tokens)
                    for track in candidates
                }

                ranked = sorted(
                    candidates,
                    key=lambda track: score_by_id.get(track.track_id, 0.0),
                    reverse=True,
                )

                min_score = 14.0
                tracks = [
                    track for track in ranked
                    if score_by_id.get(track.track_id, 0.0) >= min_score
                ][:limit]

                for track in tracks:
                    session.expunge(track)
                return tracks
        except SQLAlchemyError as e:
            logger.error(f"Error searching tracks: {e}")
            raise

    @staticmethod
    def update(track_id: int, update_data: Dict[str, Any]) -> bool:
        try:
            with get_db_session() as session:
                track = session.query(Track).filter(Track.track_id == track_id).first()
                if not track:
                    return False
                for key, value in update_data.items():
                    if hasattr(track, key):
                        setattr(track, key, value)
                track.updated_at = datetime.now(UTC)
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error updating track {track_id}: {e}")
            raise

    @staticmethod
    def delete(track_id: int) -> bool:
        try:
            with get_db_session() as session:
                track = session.query(Track).filter(Track.track_id == track_id).first()
                if not track:
                    return False
                session.delete(track)
                logger.info(f"Deleted track {track_id}")
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error deleting track {track_id}: {e}")
            raise

    @staticmethod
    def increment_play_metrics(track_id: int, listens_increment: int = 1, feature_score_increment: int = 1) -> bool:
        try:
            with get_db_session() as session:
                track = session.query(Track).filter(Track.track_id == track_id).first()
                if not track:
                    return False
                track.listens = (track.listens or 0) + max(0, listens_increment)
                track.home_feature_score = (track.home_feature_score or 0) + max(0, feature_score_increment)
                track.updated_at = datetime.now(UTC)
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error incrementing play metrics for track {track_id}: {e}")
            raise

    @staticmethod
    def get_most_listened(limit: int = 10) -> List[Track]:
        try:
            with get_db_session() as session:
                tracks = session.query(Track).order_by(desc(Track.listens)).limit(limit).all()
                for track in tracks:
                    session.expunge(track)
                return tracks
        except SQLAlchemyError as e:
            logger.error(f"Error fetching most listened tracks: {e}")
            raise

    @staticmethod
    def get_featured_for_home(limit: int = 10) -> List[Track]:
        try:
            with get_db_session() as session:
                tracks = session.query(Track).filter(
                    Track.is_featured_home == True  # noqa: E712
                ).order_by(desc(Track.home_feature_score), desc(Track.listens)).limit(limit).all()
                for track in tracks:
                    session.expunge(track)
                return tracks
        except SQLAlchemyError as e:
            logger.error(f"Error fetching featured home tracks: {e}")
            raise
