from __future__ import annotations

import threading
import time

from metadata import DEFAULT_PIPE, follow_metadata_pipe
from models import TrackMetadata


class MetadataService:
    def __init__(self, pipe=DEFAULT_PIPE) -> None:
        self.pipe = pipe
        self._latest = TrackMetadata()
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return

        self._thread = threading.Thread(
            target=self._worker,
            name="shairport-metadata",
            daemon=True,
        )
        self._thread.start()

    def _worker(self) -> None:
        while True:
            try:
                for state in follow_metadata_pipe(self.pipe):
                    with self._lock:
                        self._latest = TrackMetadata(
                            title=state.title,
                            artist=state.artist,
                            album=state.album,
                            album_artist=state.album_artist,
                            genre=state.genre,
                            composer=state.composer,
                            artwork=state.artwork,
                            artwork_track_id=state.artwork_track_id,
                            playing=state.playing,
                            connected=state.connected,
                            client_name=state.client_name,
                            track_id=state.track_id,
                        )
            except Exception as exc:
                print(
                    f"Metadata worker error: {type(exc).__name__}: {exc}",
                    flush=True,
                )
                time.sleep(1)

    def snapshot(self) -> TrackMetadata:
        with self._lock:
            state = self._latest
            return TrackMetadata(
                title=state.title,
                artist=state.artist,
                album=state.album,
                album_artist=state.album_artist,
                genre=state.genre,
                composer=state.composer,
                artwork=state.artwork,
                artwork_track_id=state.artwork_track_id,
                playing=state.playing,
                connected=state.connected,
                client_name=state.client_name,
                track_id=state.track_id,
            )
