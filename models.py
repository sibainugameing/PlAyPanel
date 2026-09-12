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
    playing: bool | None = None
    client_name: str = ""

    def as_dict(self) -> dict:
        return {
            "title": self.title,
            "artist": self.artist,
            "album": self.album,
            "album_artist": self.album_artist,
            "genre": self.genre,
            "composer": self.composer,
            "has_artwork": self.artwork is not None,
            "playing": self.playing,
            "client_name": self.client_name,
        }
