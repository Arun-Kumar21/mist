from datetime import datetime, UTC
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy import func, desc

from shared.db.database import get_db_session
from shared.db.models.playlist import Playlist, PlaylistTrack
from shared.db.models.tracks import Track


class PlaylistRepository:

    @staticmethod
    def create(user_id: UUID, name: str, description: Optional[str] = None, is_public: bool = False) -> Playlist:
        with get_db_session() as session:
            playlist = Playlist(user_id=user_id, name=name, description=description, is_public=is_public)
            session.add(playlist)
            session.flush()
            session.expunge(playlist)
            return playlist

    @staticmethod
    def get_by_id(playlist_id: UUID) -> Optional[Playlist]:
        with get_db_session() as session:
            playlist = session.query(Playlist).filter(Playlist.playlist_id == playlist_id).first()
            if playlist:
                session.expunge(playlist)
            return playlist

    @staticmethod
    def get_user_playlists(user_id: UUID) -> List[Playlist]:
        with get_db_session() as session:
            rows = session.query(Playlist).filter(Playlist.user_id == user_id).order_by(Playlist.updated_at.desc()).all()
            for row in rows:
                session.expunge(row)
            return rows

    @staticmethod
    def get_public_popular_playlists(limit: int = 10) -> List[Dict[str, Any]]:
        with get_db_session() as session:
            rows = session.query(
                Playlist,
                func.coalesce(func.sum(Track.listens), 0).label("total_listens"),
                func.count(PlaylistTrack.id).label("track_count"),
                func.max(Track.cover_image_url).label("cover_image_url"),
                func.max(Track.cover_image_key).label("cover_image_key"),
            ).outerjoin(
                PlaylistTrack,
                PlaylistTrack.playlist_id == Playlist.playlist_id,
            ).outerjoin(
                Track,
                Track.track_id == PlaylistTrack.track_id,
            ).filter(
                Playlist.is_public == True  # noqa: E712
            ).group_by(
                Playlist.playlist_id,
            ).order_by(
                desc("total_listens"),
                desc("track_count"),
                desc(Playlist.updated_at),
            ).limit(limit).all()

            return [
                {
                    "playlist": playlist.to_dict(),
                    "total_listens": int(total_listens or 0),
                    "track_count": int(track_count or 0),
                    "cover_image_url": cover_image_url,
                    "cover_image_key": cover_image_key,
                }
                for playlist, total_listens, track_count, cover_image_url, cover_image_key in rows
            ]

    @staticmethod
    def update(playlist_id: UUID, user_id: UUID, update_data: Dict[str, Any]) -> bool:
        with get_db_session() as session:
            playlist = session.query(Playlist).filter(
                Playlist.playlist_id == playlist_id,
                Playlist.user_id == user_id,
            ).first()
            if not playlist:
                return False
            for key, value in update_data.items():
                if hasattr(playlist, key):
                    setattr(playlist, key, value)
            playlist.updated_at = datetime.now(UTC)
            return True

    @staticmethod
    def delete(playlist_id: UUID, user_id: UUID) -> bool:
        with get_db_session() as session:
            playlist = session.query(Playlist).filter(
                Playlist.playlist_id == playlist_id,
                Playlist.user_id == user_id,
            ).first()
            if not playlist:
                return False
            session.delete(playlist)
            return True


class PlaylistTrackRepository:

    @staticmethod
    def add_track(playlist_id: UUID, owner_user_id: UUID, track_id: int) -> bool:
        with get_db_session() as session:
            playlist = session.query(Playlist).filter(
                Playlist.playlist_id == playlist_id,
                Playlist.user_id == owner_user_id,
            ).first()
            if not playlist:
                return False

            existing = session.query(PlaylistTrack).filter(
                PlaylistTrack.playlist_id == playlist_id,
                PlaylistTrack.track_id == track_id,
            ).first()
            if existing:
                return False

            max_position = session.query(PlaylistTrack).filter(
                PlaylistTrack.playlist_id == playlist_id
            ).count()

            row = PlaylistTrack(playlist_id=playlist_id, track_id=track_id, position=max_position)
            session.add(row)
            return True

    @staticmethod
    def remove_track(playlist_id: UUID, owner_user_id: UUID, track_id: int) -> bool:
        with get_db_session() as session:
            playlist = session.query(Playlist).filter(
                Playlist.playlist_id == playlist_id,
                Playlist.user_id == owner_user_id,
            ).first()
            if not playlist:
                return False

            row = session.query(PlaylistTrack).filter(
                PlaylistTrack.playlist_id == playlist_id,
                PlaylistTrack.track_id == track_id,
            ).first()
            if not row:
                return False

            session.delete(row)
            return True

    @staticmethod
    def get_playlist_tracks(playlist_id: UUID) -> List[Dict[str, Any]]:
        with get_db_session() as session:
            rows = session.query(PlaylistTrack, Track).join(
                Track, Track.track_id == PlaylistTrack.track_id
            ).filter(
                PlaylistTrack.playlist_id == playlist_id
            ).order_by(PlaylistTrack.position.asc(), PlaylistTrack.added_at.asc()).all()

            return [
                {
                    'position': playlist_track.position,
                    'added_at': playlist_track.added_at.isoformat() if playlist_track.added_at else None,
                    'track': track.to_dict(),
                }
                for playlist_track, track in rows
            ]
