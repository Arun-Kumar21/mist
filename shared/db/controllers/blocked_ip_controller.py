from sqlalchemy import and_, or_
from datetime import datetime, timedelta, UTC
from typing import Optional, List
import time

from shared.db.database import SessionLocal
from shared.db.models.blocked_ip import BlockedIP


class BlockedIPRepository:
    _blocked_ips_cache = set()
    _cache_expiry = 0
    _cache_duration = 60

    @staticmethod
    def is_blocked(ip_address: str) -> bool:
        current_time = time.time()
        if current_time > BlockedIPRepository._cache_expiry:
            BlockedIPRepository._refresh_cache()
        return ip_address in BlockedIPRepository._blocked_ips_cache

    @staticmethod
    def _refresh_cache():
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
        session = SessionLocal()
        try:
            existing = session.query(BlockedIP).filter(BlockedIP.ip_address == ip_address).first()
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
                return existing.id
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
            BlockedIPRepository._blocked_ips_cache.add(ip_address)
            return blocked.id
        finally:
            session.close()

    @staticmethod
    def unblock_ip(ip_address: str) -> bool:
        session = SessionLocal()
        try:
            blocked = session.query(BlockedIP).filter(BlockedIP.ip_address == ip_address).first()
            if not blocked:
                return False
            session.delete(blocked)
            session.commit()
            BlockedIPRepository._blocked_ips_cache.discard(ip_address)
            return True
        finally:
            session.close()

    @staticmethod
    def get_all_blocked() -> List[BlockedIP]:
        session = SessionLocal()
        try:
            return session.query(BlockedIP).all()
        finally:
            session.close()

    @staticmethod
    def cleanup_expired() -> int:
        session = SessionLocal()
        try:
            now = datetime.now(UTC)
            expired = session.query(BlockedIP).filter(
                BlockedIP.is_permanent == False,
                BlockedIP.expires_at <= now
            ).all()
            count = len(expired)
            for record in expired:
                session.delete(record)
            session.commit()
            BlockedIPRepository._refresh_cache()
            return count
        finally:
            session.close()
