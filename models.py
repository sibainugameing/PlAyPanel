from __future__ import annotations

from dataclasses import dataclass


@dataclass
class TrackMetadata:
    title: str = ""
    artist: str = ""
    album: str = ""
    album_artist: str = ""
    genre: str = ""
    composer: str = ""
    artwork: bytes | None = None
    artwork_track_id: str = ""
    playing: bool | None = None
    connected: bool = False
    client_name: str = ""
    track_id: str = ""

    def as_dict(self) -> dict:
        return {
            "title": self.title,
            "artist": self.artist,
            "album": self.album,
            "album_artist": self.album_artist,
            "genre": self.genre,
            "composer": self.composer,
            "has_artwork": self.artwork is not None,
            "artwork_track_id": self.artwork_track_id,
            "playing": self.playing,
            "connected": self.connected,
            "client_name": self.client_name,
            "track_id": self.track_id,
        }
