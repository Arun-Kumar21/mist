from sqlalchemy import func, desc
from datetime import datetime, timedelta, UTC
from typing import List, Dict

from db.database import SessionLocal
from db.models.listening_history import UserListeningHistory, DailyListenQuota
from db.models.tracks import Track


class AnalyticsRepository:
    
    @staticmethod
    def get_user_stats(user_id: str) -> Dict:
        """Get listening stats for a user"""
        session = SessionLocal()
        try:
            total_listens = session.query(func.count(UserListeningHistory.id)).filter(
                UserListeningHistory.user_id == user_id
            ).scalar()
            
            completed_listens = session.query(func.count(UserListeningHistory.id)).filter(
                UserListeningHistory.user_id == user_id,
                UserListeningHistory.completed == True
            ).scalar()
            
            total_minutes = session.query(
                func.sum(UserListeningHistory.duration_listened)
            ).filter(
                UserListeningHistory.user_id == user_id
            ).scalar() or 0
            
            total_minutes = total_minutes / 60.0
            
            # Last 7 days activity
            seven_days_ago = datetime.now(UTC) - timedelta(days=7)
            recent_activity = session.query(DailyListenQuota).filter(
                DailyListenQuota.user_id == user_id,
                DailyListenQuota.date >= seven_days_ago
            ).all()
            
            return {
                "total_listens": total_listens,
                "completed_listens": completed_listens,
                "total_minutes": round(total_minutes, 2),
                "total_hours": round(total_minutes / 60, 2),
                "recent_days": len(recent_activity),
                "recent_activity": [
                    {
                        "date": activity.date.date().isoformat(),
                        "minutes": round(activity.minutes_listened, 2),
                        "tracks_started": activity.tracks_started,
                        "tracks_completed": activity.tracks_completed
                    }
                    for activity in recent_activity
                ]
            }
        finally:
            session.close()
    
    @staticmethod
    def get_popular_tracks(limit: int = 10) -> List[Dict]:
        """Get most played tracks"""
        session = SessionLocal()
        try:
            popular = session.query(
                Track.track_id,
                Track.title,
                Track.artist_name,
                func.count(UserListeningHistory.id).label('play_count')
            ).join(
                UserListeningHistory,
                Track.track_id == UserListeningHistory.track_id
            ).group_by(
                Track.track_id
            ).order_by(
                desc('play_count')
            ).limit(limit).all()
            
            return [
                {
                    "track_id": row.track_id,
                    "title": row.title,
                    "artist": row.artist_name,
                    "play_count": row.play_count
                }
                for row in popular
            ]
        finally:
            session.close()
    
    @staticmethod
    def get_user_top_genres(user_id: str, limit: int = 5) -> List[Dict]:
        """Get user's most listened genres"""
        session = SessionLocal()
        try:
            top_genres = session.query(
                Track.genre_top,
                func.count(UserListeningHistory.id).label('listen_count')
            ).join(
                UserListeningHistory,
                Track.track_id == UserListeningHistory.track_id
            ).filter(
                UserListeningHistory.user_id == user_id,
                Track.genre_top.isnot(None)
            ).group_by(
                Track.genre_top
            ).order_by(
                desc('listen_count')
            ).limit(limit).all()
            
            return [
                {
                    "genre": row.genre_top,
                    "listen_count": row.listen_count
                }
                for row in top_genres
            ]
        finally:
            session.close()
    
    @staticmethod
    def get_user_top_artists(user_id: str, limit: int = 5) -> List[Dict]:
        """Get user's most listened artists"""
        session = SessionLocal()
        try:
            top_artists = session.query(
                Track.artist_name,
                func.count(UserListeningHistory.id).label('listen_count')
            ).join(
                UserListeningHistory,
                Track.track_id == UserListeningHistory.track_id
            ).filter(
                UserListeningHistory.user_id == user_id,
                Track.artist_name.isnot(None)
            ).group_by(
                Track.artist_name
            ).order_by(
                desc('listen_count')
            ).limit(limit).all()
            
            return [
                {
                    "artist": row.artist_name,
                    "listen_count": row.listen_count
                }
                for row in top_artists
            ]
        finally:
            session.close()
