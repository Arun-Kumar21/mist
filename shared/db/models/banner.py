from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from datetime import datetime, UTC
from shared.db.database import Base


class Banner(Base):
    __tablename__ = 'banners'

    banner_id = Column(Integer, primary_key=True)
    title = Column(String(500), nullable=True)
    subtitle = Column(String(500), nullable=True)
    image_url = Column(Text, nullable=True)
    image_key = Column(String(1000), nullable=True)
    link_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.now(UTC))
    updated_at = Column(DateTime, default=datetime.now(UTC), onupdate=datetime.now(UTC))

    def to_dict(self):
        return {
            'banner_id': self.banner_id,
            'title': self.title,
            'subtitle': self.subtitle,
            'image_url': self.image_url,
            'link_url': self.link_url,
            'is_active': self.is_active,
            'display_order': self.display_order,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
