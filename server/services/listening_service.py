from typing import Optional, Dict
from datetime import datetime, UTC
from db.controllers.listening_history_controller import ListeningHistoryRepository, DailyQuotaRepository
from db.models.user import User, UserRole


class QuotaLimits:
    FREE_DAILY_MINUTES = 5 
    PREMIUM_DAILY_MINUTES = float('inf')  # unlimited


class ListeningService:

    @staticmethod
    def get_user_quota_limit(user: User) -> float:
        # TODO: return premium limit when subscription is implemented
        return QuotaLimits.FREE_DAILY_MINUTES

    @staticmethod
    def check_quota_available(user_id: str, ip_address: str, user: User) -> Dict:
        quota_limit = ListeningService.get_user_quota_limit(user)
        minutes_used = DailyQuotaRepository.get_today_minutes(user_id, ip_address)
        minutes_remaining = quota_limit - minutes_used
        return {
            "has_quota": minutes_remaining > 0,
            "quota_limit": quota_limit,
            "minutes_used": minutes_used,
            "minutes_remaining": max(0, minutes_remaining),
            "unlimited": quota_limit == float('inf')
        }

    @staticmethod
    def start_listening_session(user_id: Optional[str], track_id: int, ip_address: str) -> int:
        return ListeningHistoryRepository.create(user_id, track_id, ip_address)

    @staticmethod
    def update_listening_progress(history_id: int, duration_seconds: float, user_id: Optional[str] = None, ip_address: Optional[str] = None) -> bool:
        history = ListeningHistoryRepository.get_by_id(history_id)
        if not history:
            return False
        previous_duration = history.duration_listened or 0
        duration_diff = duration_seconds - previous_duration
        if duration_diff > 0 and (user_id or ip_address):
            quota = DailyQuotaRepository.get_or_create_today(user_id, ip_address)
            DailyQuotaRepository.update_quota(
                quota.id,
                minutes_listened=duration_diff / 60.0,
                tracks_started=0
            )
        return ListeningHistoryRepository.update_duration(history_id, duration_seconds, completed=False)

    @staticmethod
    def complete_listening_session(history_id: int, total_duration: float, user_id: Optional[str], ip_address: str) -> bool:
        history = ListeningHistoryRepository.get_by_id(history_id)
        if not history:
            return False
        previous_duration = history.duration_listened or 0
        duration_diff = total_duration - previous_duration
        ListeningHistoryRepository.update_duration(history_id, total_duration, completed=True)
        quota = DailyQuotaRepository.get_or_create_today(user_id, ip_address)
        DailyQuotaRepository.update_quota(
            quota.id,
            minutes_listened=max(0.0, duration_diff / 60.0),
            tracks_completed=1
        )
        return True

    @staticmethod
    def increment_track_started(user_id: Optional[str], ip_address: str) -> None:
        quota = DailyQuotaRepository.get_or_create_today(user_id, ip_address)
        DailyQuotaRepository.update_quota(quota.id, minutes_listened=0, tracks_started=1)
