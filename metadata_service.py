from __future__ import annotations

import threading
import time
from collections import OrderedDict

from metadata import DEFAULT_PIPE, follow_metadata_pipe
from models import TrackMetadata


class MetadataService:
    def __init__(self, pipe=DEFAULT_PIPE, artwork_cache_size: int = 32) -> None:
        self.pipe = pipe
        self._latest = TrackMetadata()
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._artwork_cache: OrderedDict[str, bytes] = OrderedDict()
        self._artwork_cache_size = max(1, artwork_cache_size)

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return

        self._thread = threading.Thread(
            target=self._worker,
            name="shairport-metadata",
            daemon=True,
        )
        self._thread.start()

    def _copy_state(self, state: TrackMetadata) -> TrackMetadata:
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

    def _remember_artwork(self, state: TrackMetadata) -> None:
        if not state.artwork or not state.artwork_track_id:
            return

        track_id = state.artwork_track_id
        self._artwork_cache[track_id] = state.artwork
        self._artwork_cache.move_to_end(track_id)

        while len(self._artwork_cache) > self._artwork_cache_size:
            self._artwork_cache.popitem(last=False)

    def _restore_cached_artwork(self, state: TrackMetadata) -> None:
        if state.artwork is not None or not state.track_id:
            return

        cached_artwork = self._artwork_cache.get(state.track_id)
        if cached_artwork is None:
            return

        state.artwork = cached_artwork
        state.artwork_track_id = state.track_id
        self._artwork_cache.move_to_end(state.track_id)

    def _worker(self) -> None:
        while True:
            try:
                for state in follow_metadata_pipe(self.pipe):
                    with self._lock:
                        self._remember_artwork(state)
                        self._restore_cached_artwork(state)
                        self._latest = self._copy_state(state)
            except Exception as exc:
                print(
                    f"Metadata worker error: {type(exc).__name__}: {exc}",
                    flush=True,
                )
                time.sleep(1)

    def snapshot(self) -> TrackMetadata:
        with self._lock:
            state = self._copy_state(self._latest)
            self._restore_cached_artwork(state)
            return state

    def artwork_for_track(self, track_id: str) -> bytes | None:
        if not track_id:
            return None

        with self._lock:
            cached_artwork = self._artwork_cache.get(track_id)
            if cached_artwork is not None:
                self._artwork_cache.move_to_end(track_id)
                return cached_artwork

            if self._latest.track_id == track_id:
                self._restore_cached_artwork(self._latest)
                return self._latest.artwork

        return None
