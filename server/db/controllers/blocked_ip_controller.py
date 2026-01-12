from sqlalchemy import and_, or_
from datetime import datetime, timedelta, UTC
from typing import Optional, List
import time

from db.database import SessionLocal
from db.models.blocked_ip import BlockedIP


class BlockedIPRepository:
    # In-memory cache for blocked IPs (refreshed every 60 seconds)
    _blocked_ips_cache = set()
    _cache_expiry = 0
    _cache_duration = 60  # seconds
    
    @staticmethod
    def is_blocked(ip_address: str) -> bool:
        """Check if IP is currently blocked (with caching)"""
        current_time = time.time()
        
        # Refresh cache if expired
        if current_time > BlockedIPRepository._cache_expiry:
            BlockedIPRepository._refresh_cache()
        
        # Fast in-memory lookup
        return ip_address in BlockedIPRepository._blocked_ips_cache
    
    @staticmethod
    def _refresh_cache():
        """Refresh the blocked IPs cache from database"""
        session = SessionLocal()
        try:
            now = datetime.now(UTC)
            blocked_ips = session.query(BlockedIP.ip_address).filter(
                or_(
                    BlockedIP.is_permanent == True,
                    BlockedIP.expires_at.is_(None),
                    BlockedIP.expires_at > now
                )
            ).all()
            
            BlockedIPRepository._blocked_ips_cache = {ip[0] for ip in blocked_ips}
            BlockedIPRepository._cache_expiry = time.time() + BlockedIPRepository._cache_duration
        finally:
            session.close()
    
    @staticmethod
    def block_ip(ip_address: str, reason: str = None, duration_hours: Optional[int] = None) -> int:
        """Block an IP address"""
        session = SessionLocal()
        try:
            existing = session.query(BlockedIP).filter(
                BlockedIP.ip_address == ip_address
            ).first()
            
            if existing:
                if duration_hours:
                    existing.expires_at = datetime.now(UTC) + timedelta(hours=duration_hours)
                    existing.is_permanent = False
                else:
                    existing.is_permanent = True
                    existing.expires_at = None
                if reason:
                    existing.reason = reason
                session.commit()
                result_id = existing.id
            else:
                expires_at = None
                is_permanent = True
                
                if duration_hours:
                    expires_at = datetime.now(UTC) + timedelta(hours=duration_hours)
                    is_permanent = False
                
                blocked = BlockedIP(
                    ip_address=ip_address,
                    reason=reason,
                    expires_at=expires_at,
                    is_permanent=is_permanent
                )
                session.add(blocked)
                session.commit()
                session.refresh(blocked)
                result_id = blocked.id
            
            # Invalidate cache to force refresh
            BlockedIPRepository._cache_expiry = 0
            return result_id
        finally:
            session.close()
    
    @staticmethod
    def unblock_ip(ip_address: str) -> bool:
        """Unblock an IP address"""
        session = SessionLocal()
        try:
            blocked = session.query(BlockedIP).filter(
                BlockedIP.ip_address == ip_address
            ).first()
            
            if blocked:
                session.delete(blocked)
                session.commit()
                # Invalidate cache to force refresh
                BlockedIPRepository._cache_expiry = 0
                return True
            return False
        finally:
            session.close()
    
    @staticmethod
    def get_all_blocked() -> List[BlockedIP]:
        """Get all blocked IPs"""
        session = SessionLocal()
        try:
            return session.query(BlockedIP).all()
        finally:
            session.close()
    
    @staticmethod
    def cleanup_expired() -> int:
        """Remove expired blocks"""
        session = SessionLocal()
        try:
            now = datetime.now(UTC)
            count = session.query(BlockedIP).filter(
                and_(
                    BlockedIP.is_permanent == False,
                    BlockedIP.expires_at < now
                )
            ).delete()
            session.commit()
            return count
        finally:
            session.close()
