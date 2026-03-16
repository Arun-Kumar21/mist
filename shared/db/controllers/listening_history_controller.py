from sqlalchemy import and_, desc, func
from datetime import datetime, UTC
from typing import Optional
from uuid import UUID

from shared.db.database import SessionLocal
from shared.db.models.listening_history import UserListeningHistory, DailyListenQuota
from shared.db.models.tracks import Track


class ListeningHistoryRepository:

    @staticmethod
    def create(user_id: Optional[str], track_id: int, ip_address: str) -> int:
        session = SessionLocal()
        try:
            history = UserListeningHistory(user_id=user_id, track_id=track_id, ip_address=ip_address)
            session.add(history)
            session.commit()
            session.refresh(history)
            return history.id
        finally:
            session.close()

    @staticmethod
    def update_duration(history_id: int, duration: float, completed: bool = False) -> bool:
        session = SessionLocal()
        try:
            history = session.query(UserListeningHistory).filter(
                UserListeningHistory.id == history_id
            ).first()
            if history:
                history.duration_listened = duration
                history.completed = completed
                session.commit()
                return True
            return False
        finally:
            session.close()

    @staticmethod
    def get_by_id(history_id: int) -> Optional[UserListeningHistory]:
        session = SessionLocal()
        try:
            return session.query(UserListeningHistory).filter(
                UserListeningHistory.id == history_id
            ).first()
        finally:
            session.close()

    @staticmethod
    def get_user_top_tracks(user_id: UUID, limit: int = 10) -> list[dict]:
        session = SessionLocal()
        try:
            rows = session.query(
                Track,
                func.count(UserListeningHistory.id).label("play_count"),
                func.sum(UserListeningHistory.duration_listened).label("total_duration"),
            ).join(
                UserListeningHistory,
                Track.track_id == UserListeningHistory.track_id,
            ).filter(
                UserListeningHistory.user_id == user_id,
            ).group_by(
                Track.track_id,
            ).order_by(
                desc("play_count"),
                desc("total_duration"),
            ).limit(limit).all()

            return [
                {
                    "track": track.to_dict(),
                    "play_count": int(play_count or 0),
                    "total_duration": float(total_duration or 0),
                }
                for track, play_count, total_duration in rows
            ]
        finally:
            session.close()


class DailyQuotaRepository:

    @staticmethod
    def _normalize_user_id(user_id: Optional[str]):
        if not user_id:
            return None
        if isinstance(user_id, UUID):
            return user_id
        try:
            return UUID(str(user_id))
        except (ValueError, TypeError):
            return None

    @staticmethod
    def get_or_create_today(user_id: Optional[str], ip_address: Optional[str]) -> DailyListenQuota:
        session = SessionLocal()
        try:
            day_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start.replace(hour=23, minute=59, second=59, microsecond=999999)

            normalized_user_id = DailyQuotaRepository._normalize_user_id(user_id)

            query = session.query(DailyListenQuota).filter(
                DailyListenQuota.date >= day_start,
                DailyListenQuota.date <= day_end,
            )
            if normalized_user_id:
                query = query.filter(DailyListenQuota.user_id == normalized_user_id)
            else:
                query = query.filter(
                    and_(DailyListenQuota.user_id.is_(None), DailyListenQuota.ip_address == ip_address)
                )
            quota = query.first()
            if not quota:
                quota = DailyListenQuota(user_id=normalized_user_id, date=day_start, ip_address=ip_address)
                session.add(quota)
                session.commit()
                session.refresh(quota)
            return quota
        finally:
            session.close()

    @staticmethod
    def update_quota(quota_id: int, minutes_listened: float, tracks_started: int = 0, tracks_completed: int = 0) -> bool:
        session = SessionLocal()
        try:
            quota = session.query(DailyListenQuota).filter(DailyListenQuota.id == quota_id).first()
            if quota:
                quota.minutes_listened += minutes_listened
                quota.tracks_started += tracks_started
                quota.tracks_completed += tracks_completed
                session.commit()
                return True
            return False
        finally:
            session.close()

    @staticmethod
    def get_today_minutes(user_id: Optional[str], ip_address: Optional[str]) -> float:
        quota = DailyQuotaRepository.get_or_create_today(user_id, ip_address)
        return quota.minutes_listened
