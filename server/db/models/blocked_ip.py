from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from datetime import datetime, UTC

from db.database import Base


class BlockedIP(Base):
    __tablename__ = "blocked_ips"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ip_address = Column(String(45), unique=True, nullable=False, index=True)
    reason = Column(String(255), nullable=True)
    blocked_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_permanent = Column(Boolean, default=False)
    
    def to_dict(self):
        return {
            "id": self.id,
            "ip_address": self.ip_address,
            "reason": self.reason,
            "blocked_at": self.blocked_at.isoformat() if self.blocked_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_permanent": self.is_permanent
        }
