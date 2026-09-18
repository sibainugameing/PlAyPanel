from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_static(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_now_playing_is_polled_only_by_app_module() -> None:
    app_js = read_static("static/js/app.js")
    lyrics_js = read_static("static/js/lyrics.js")
    progress_js = read_static("static/js/progress.js")

    assert "fetch('/now-playing.json'" in app_js
    assert "fetch('/now-playing.json'" not in lyrics_js
    assert "fetch('/now-playing.json'" not in progress_js
    assert "window.PLAYPANEL_STATE" in app_js
    assert "playpanel:now-playing" in app_js
    assert "playpanel:now-playing" in lyrics_js
    assert "playpanel:now-playing" in progress_js


def test_lyrics_positive_offset_is_subtracted_from_audio_position() -> None:
    lyrics_js = read_static("static/js/lyrics.js")
    assert "getAudioPositionMs() - (syncOffsetSeconds * 1000)" in lyrics_js
