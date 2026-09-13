from __future__ import annotations

from dataclasses import dataclass
import time


RTP_CLOCK_RATE = 44100.0
RTP_MODULUS = 2**32


def rtp_delta(start: int, end: int) -> int:
    return (end - start) % RTP_MODULUS


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
    progress_start_rtp: int | None = None
    progress_current_rtp: int | None = None
    progress_end_rtp: int | None = None
    progress_elapsed_seconds: float = 0.0
    progress_anchor_monotonic: float | None = None
    song_duration_seconds: float | None = None

    def set_progress(self, start: int, current: int, end: int) -> None:
        duration_frames = rtp_delta(start, end)
        elapsed_frames = rtp_delta(start, current)

        self.progress_start_rtp = start
        self.progress_current_rtp = current
        self.progress_end_rtp = end
        self.progress_elapsed_seconds = min(
            elapsed_frames / RTP_CLOCK_RATE,
            duration_frames / RTP_CLOCK_RATE if duration_frames else float("inf"),
        )
        self.progress_anchor_monotonic = time.monotonic() if self.playing is True else None

    def set_song_duration_frames(self, frames: int) -> None:
        if frames <= 0 or frames >= RTP_MODULUS:
            self.song_duration_seconds = None
            return
        self.song_duration_seconds = frames / RTP_CLOCK_RATE

    def reset_progress(self) -> None:
        self.progress_start_rtp = None
        self.progress_current_rtp = None
        self.progress_end_rtp = None
        self.progress_elapsed_seconds = 0.0
        self.progress_anchor_monotonic = None
        self.song_duration_seconds = None

    def freeze_progress(self) -> None:
        if self.progress_anchor_monotonic is None:
            return
        self.progress_elapsed_seconds = self.current_elapsed_seconds()
        self.progress_anchor_monotonic = None

    def resume_progress(self) -> None:
        if self.duration_seconds() is None:
            return
        self.progress_anchor_monotonic = time.monotonic()

    def current_elapsed_seconds(self) -> float:
        elapsed = self.progress_elapsed_seconds
        if self.progress_anchor_monotonic is not None and self.playing is True:
            elapsed += max(0.0, time.monotonic() - self.progress_anchor_monotonic)

        duration = self.duration_seconds()
        if duration is not None:
            elapsed = min(elapsed, duration)
        return max(0.0, elapsed)

    def duration_seconds(self) -> float | None:
        if self.progress_start_rtp is not None and self.progress_end_rtp is not None:
            duration_frames = rtp_delta(self.progress_start_rtp, self.progress_end_rtp)
            if duration_frames > 0:
                return duration_frames / RTP_CLOCK_RATE
        return self.song_duration_seconds

    def progress_ratio(self) -> float | None:
        duration = self.duration_seconds()
        if duration is None or duration <= 0:
            return None
        return min(1.0, max(0.0, self.current_elapsed_seconds() / duration))

    def as_dict(self) -> dict:
        duration = self.duration_seconds()
        elapsed = self.current_elapsed_seconds()
        ratio = self.progress_ratio()

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
            "progress": {
                "available": duration is not None,
                "elapsed_seconds": round(elapsed, 3),
                "duration_seconds": round(duration, 3) if duration is not None else None,
                "ratio": round(ratio, 5) if ratio is not None else None,
            },
        }
