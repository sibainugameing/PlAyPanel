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


def test_track_change_wakes_screen_and_resets_blank_timer() -> None:
    app_js = read_static("static/js/app.js")
    assert "wakeScreen();" in app_js
    assert "if (trackChanged) {" in app_js
    track_change_block = app_js.split("if (trackChanged) {", 1)[1].split("} else if", 1)[0]
    assert track_change_block.index("wakeScreen();") < track_change_block.index("currentTrackKey = trackKey;")


def test_lyrics_positive_offset_is_subtracted_from_audio_position() -> None:
    lyrics_js = read_static("static/js/lyrics.js")
    assert "getAudioPositionMs() - (syncOffsetSeconds * 1000)" in lyrics_js


def test_view_mode_toggle_is_present_and_persistent() -> None:
    html = (ROOT / "templates/index.html").read_text(encoding="utf-8")
    app_js = read_static("static/js/app.js")
    style_css = read_static("static/css/style.css")

    assert 'id="view-mode-toggle"' in html
    assert "setupViewMode()" in app_js
    assert "localStorage.setItem('playpanel:view-mode', viewMode)" in app_js
    assert "body.clock-mode .clock" in style_css
    assert "body.clock-mode .panel" in style_css


def test_horizontal_player_and_lyrics_layout_contract() -> None:
    html = (ROOT / "templates/index.html").read_text(encoding="utf-8")
    app_js = read_static("static/js/app.js")
    lyrics_js = read_static("static/js/lyrics.js")
    progress_js = read_static("static/js/progress.js")
    player_css = read_static("static/css/player.css")

    assert 'class="player-card"' in html
    assert 'id="player-artwork"' in html
    assert 'id="player-progress__value"' in html
    assert 'id="player-client-name"' in html
    assert "setPlayerArtwork(artworkUrl);" in app_js
    assert "setPlayerMetadata(data);" in app_js
    assert "player-progress__value" in progress_js
    assert "let lyricsMode = false;" in lyrics_js
    assert "setMode(document.body.classList.contains('clock-mode'));" in lyrics_js
    assert ".player-card" in player_css
    assert "body.clock-mode .visual" in player_css
    assert "body.clock-mode .player-card" in player_css
    assert "playpanel:view-mode" in lyrics_js
