from typing import Optional, Dict
from datetime import datetime, UTC
from db.controllers.listening_history_controller import ListeningHistoryRepository, DailyQuotaRepository
from db.models.user import User, UserRole


class QuotaLimits:
    FREE_DAILY_MINUTES = 30  # 30 min
    ANONYMOUS_DAILY_MINUTES = 10  # 10 minutes
    PREMIUM_DAILY_MINUTES = float('inf')  # unlimited


class ListeningService:
    
    @staticmethod
    def get_user_quota_limit(user: Optional[User]) -> float:
        """Get daily listening limit in minutes"""
        if not user:
            return QuotaLimits.ANONYMOUS_DAILY_MINUTES
        
        # TODO: Check if user has premium subscription
        # For now, all authenticated users are "free"
        return QuotaLimits.FREE_DAILY_MINUTES
    
    @staticmethod
    def check_quota_available(user_id: Optional[str], ip_address: str, user: Optional[User] = None) -> Dict:
        """Check if user has available listening quota"""
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
        """Start a new listening session"""
        return ListeningHistoryRepository.create(user_id, track_id, ip_address)
    
    @staticmethod
    def update_listening_progress(history_id: int, duration_seconds: float, user_id: Optional[str] = None, ip_address: Optional[str] = None) -> bool:
        """Update listening progress and quota in real-time"""
        history = ListeningHistoryRepository.get_by_id(history_id)
        if not history:
            return False
        
        # Calculate the time difference since last update
        previous_duration = history.duration_listened or 0
        duration_diff = duration_seconds - previous_duration
        
        # Only update quota if there's a positive difference (user listened more)
        if duration_diff > 0 and (user_id or ip_address):
            quota = DailyQuotaRepository.get_or_create_today(user_id, ip_address)
            minutes_diff = duration_diff / 60.0
            DailyQuotaRepository.update_quota(
                quota.id,
                minutes_listened=minutes_diff,
                tracks_started=0
            )
        
        return ListeningHistoryRepository.update_duration(
            history_id, 
            duration_seconds, 
            completed=False
        )
    
    @staticmethod
    def complete_listening_session(history_id: int, total_duration: float, user_id: Optional[str], ip_address: str) -> bool:
        """Mark session as complete and update daily quota"""
        history = ListeningHistoryRepository.get_by_id(history_id)
        if not history:
            return False
        
        # Calculate any remaining time not yet counted in quota
        previous_duration = history.duration_listened or 0
        duration_diff = total_duration - previous_duration
        
        ListeningHistoryRepository.update_duration(history_id, total_duration, completed=True)
        
        # Only add the difference if positive (and if user exists)
        if duration_diff > 0:
            quota = DailyQuotaRepository.get_or_create_today(user_id, ip_address)
            minutes_diff = duration_diff / 60.0
            
            DailyQuotaRepository.update_quota(
                quota.id,
                minutes_listened=minutes_diff,
                tracks_completed=1
            )
        else:
            # Still mark as completed even if no new time
            quota = DailyQuotaRepository.get_or_create_today(user_id, ip_address)
            DailyQuotaRepository.update_quota(
                quota.id,
                minutes_listened=0,
                tracks_completed=1
            )
        
        return True
    
    @staticmethod
    def increment_track_started(user_id: Optional[str], ip_address: str) -> None:
        """Increment tracks started counter"""
        quota = DailyQuotaRepository.get_or_create_today(user_id, ip_address)
        DailyQuotaRepository.update_quota(quota.id, minutes_listened=0, tracks_started=1)
