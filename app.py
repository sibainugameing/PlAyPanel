from __future__ import annotations

import threading
from pathlib import Path

from flask import Flask, jsonify

from shairport import DEFAULT_PIPE, TrackMetadata, follow_metadata_pipe


app = Flask(__name__)

METADATA_PIPE = DEFAULT_PIPE

_latest = TrackMetadata()
_lock = threading.Lock()


def metadata_worker() -> None:
    global _latest

    while True:
        try:
            for state in follow_metadata_pipe(METADATA_PIPE):
                with _lock:
                    _latest = TrackMetadata(
                        title=state.title,
                        artist=state.artist,
                        album=state.album,
                        album_artist=state.album_artist,
                        genre=state.genre,
                        composer=state.composer,
                        artwork=state.artwork,
                        playing=state.playing,
                        client_name=state.client_name,
                    )
        except (FileNotFoundError, OSError):
            # Shairport Sync may be stopped or the metadata pipe may not exist yet.
            # Retry without taking down the web server.
            threading.Event().wait(2)


def start_metadata_worker() -> None:
    thread = threading.Thread(target=metadata_worker, name="shairport-metadata", daemon=True)
    thread.start()


@app.get("/")
def index():
    return jsonify(
        {
            "app": "PlayPanel",
            "status": "ok",
            "metadata_pipe": str(METADATA_PIPE),
            "metadata_pipe_exists": METADATA_PIPE.exists(),
        }
    )


@app.get("/now-playing.json")
def now_playing():
    with _lock:
        data = _latest.as_dict()

    return jsonify(data)


if __name__ == "__main__":
    start_metadata_worker()
    app.run(host="0.0.0.0", port=8765, debug=True, use_reloader=False)
