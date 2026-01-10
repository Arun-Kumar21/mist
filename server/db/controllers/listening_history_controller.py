from sqlalchemy import and_, func
from datetime import datetime, timedelta, UTC
from typing import Optional, List

from db.database import SessionLocal
from db.models.listening_history import UserListeningHistory, DailyListenQuota


class ListeningHistoryRepository:
    
    @staticmethod
    def create(user_id: Optional[str], track_id: int, ip_address: str) -> int:
        session = SessionLocal()
        try:
            history = UserListeningHistory(
                user_id=user_id,
                track_id=track_id,
                ip_address=ip_address
            )
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


class DailyQuotaRepository:
    
    @staticmethod
    def get_or_create_today(user_id: Optional[str], ip_address: Optional[str]) -> DailyListenQuota:
        session = SessionLocal()
        try:
            today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
            
            query = session.query(DailyListenQuota).filter(
                DailyListenQuota.date == today
            )
            
            if user_id:
                query = query.filter(DailyListenQuota.user_id == user_id)
            else:
                query = query.filter(
                    and_(
                        DailyListenQuota.user_id.is_(None),
                        DailyListenQuota.ip_address == ip_address
                    )
                )
            
            quota = query.first()
            
            if not quota:
                quota = DailyListenQuota(
                    user_id=user_id,
                    date=today,
                    ip_address=ip_address
                )
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
            quota = session.query(DailyListenQuota).filter(
                DailyListenQuota.id == quota_id
            ).first()
            
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
