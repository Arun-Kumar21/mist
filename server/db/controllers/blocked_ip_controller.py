from sqlalchemy import and_, or_
from datetime import datetime, timedelta, UTC
from typing import Optional, List

from db.database import SessionLocal
from db.models.blocked_ip import BlockedIP


class BlockedIPRepository:
    
    @staticmethod
    def is_blocked(ip_address: str) -> bool:
        """Check if IP is currently blocked"""
        session = SessionLocal()
        try:
            now = datetime.now(UTC)
            blocked = session.query(BlockedIP).filter(
                and_(
                    BlockedIP.ip_address == ip_address,
                    or_(
                        BlockedIP.is_permanent == True,
                        BlockedIP.expires_at.is_(None),
                        BlockedIP.expires_at > now
                    )
                )
            ).first()
            return blocked is not None
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
            return blocked.id
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
