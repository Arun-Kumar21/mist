from sqlalchemy import func, desc
from datetime import datetime, timedelta, UTC
from typing import List, Dict

from shared.db.database import SessionLocal
from shared.db.models.listening_history import UserListeningHistory, DailyListenQuota
from shared.db.models.tracks import Track
from shared.db.models.admin_curated_track import AdminCuratedTrack


class AnalyticsRepository:

    @staticmethod
    def get_popular_tracks(limit: int = 10) -> List[Dict]:
        session = SessionLocal()
        try:
            popular = session.query(
                Track.track_id,
                Track.title,
                Track.artist_name,
                func.count(UserListeningHistory.id).label('play_count')
            ).join(
                UserListeningHistory, Track.track_id == UserListeningHistory.track_id
            ).group_by(Track.track_id).order_by(desc('play_count')).limit(limit).all()
            return [
                {"track_id": row.track_id, "title": row.title, "artist": row.artist_name, "play_count": row.play_count}
                for row in popular
            ]
        finally:
            session.close()

    @staticmethod
    def get_user_stats(user_id: str) -> Dict:
        session = SessionLocal()
        try:
            total_listens = session.query(func.count(UserListeningHistory.id)).filter(
                UserListeningHistory.user_id == user_id
            ).scalar()
            total_minutes = session.query(
                func.sum(UserListeningHistory.duration_listened)
            ).filter(UserListeningHistory.user_id == user_id).scalar() or 0
            total_minutes = total_minutes / 60.0
            seven_days_ago = datetime.now(UTC) - timedelta(days=7)
            recent_activity = session.query(DailyListenQuota).filter(
                DailyListenQuota.user_id == user_id,
                DailyListenQuota.date >= seven_days_ago
            ).all()
            return {
                "total_listens": total_listens,
                "total_minutes": round(total_minutes, 2),
                "recent_days": len(recent_activity),
            }
        finally:
            session.close()

    @staticmethod
    def get_most_listened_tracks(limit: int = 10) -> List[Dict]:
        session = SessionLocal()
        try:
            rows = session.query(Track).order_by(desc(Track.listens)).limit(limit).all()
            return [row.to_dict() for row in rows]
        finally:
            session.close()

    @staticmethod
    def get_featured_home_tracks(limit: int = 10) -> List[Dict]:
        session = SessionLocal()
        try:
            rows = session.query(Track).filter(
                Track.is_featured_home == True  # noqa: E712
            ).order_by(desc(Track.home_feature_score), desc(Track.listens)).limit(limit).all()
            return [row.to_dict() for row in rows]
        finally:
            session.close()

    @staticmethod
    def get_admin_top_picks(limit: int = 10) -> List[Dict]:
        session = SessionLocal()
        try:
            rows = session.query(AdminCuratedTrack, Track).join(
                Track, Track.track_id == AdminCuratedTrack.track_id
            ).filter(
                AdminCuratedTrack.is_active == True  # noqa: E712
            ).order_by(
                AdminCuratedTrack.display_order.asc(),
                AdminCuratedTrack.updated_at.desc(),
            ).limit(limit).all()
            return [
                {
                    'curation': curated.to_dict(),
                    'track': track.to_dict(),
                }
                for curated, track in rows
            ]
        finally:
            session.close()
