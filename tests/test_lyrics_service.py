from __future__ import annotations

from lyrics.service import LyricsService


def test_normalize_collapses_whitespace() -> None:
    assert LyricsService._normalize("  Foo\u3000 Bar  ") == "foo bar"


def test_title_variants_remove_common_suffixes() -> None:
    variants = LyricsService._title_variants("Song (feat. Alice)")
    assert variants == ["Song (feat. Alice)", "Song", "Song"] or variants == ["Song (feat. Alice)", "Song"]


def test_parse_lrc_supports_multiple_timestamps() -> None:
    text = "[00:01.5][00:03.25]Hello\n[00:05]World"
    assert LyricsService._parse_lrc(text) == [
        {"time_ms": 1500, "text": "Hello"},
        {"time_ms": 3250, "text": "Hello"},
        {"time_ms": 5000, "text": "World"},
    ]


def test_candidate_score_prefers_exact_metadata() -> None:
    candidate = {
        "trackName": "My Song",
        "artistName": "Artist",
        "albumName": "Album",
        "syncedLyrics": "[00:01.00]Hello",
    }
    has_synced, score = LyricsService._candidate_score(
        "My Song", "Artist", "Album", candidate
    )
    assert has_synced == 1
    assert score > 1.0


def test_cached_lookup_avoids_second_remote_request(tmp_path, monkeypatch) -> None:
    service = LyricsService(
        str(tmp_path),
        timeout_seconds=1.0,
        max_entries=10,
        negative_cache_ttl_seconds=3600.0,
    )
    calls = []

    def fake_fetch(title: str, artist: str, album: str):
        calls.append((title, artist, album))
        return "[00:01.00]Hello", "Hello"

    monkeypatch.setattr(service, "_fetch_remote", fake_fetch)

    first = service.get("Song", "Artist", "Album")
    second = service.get("Song", "Artist", "Album")

    assert first["found"] is True
    assert first["synced"] is True
    assert first["lines"] == [{"time_ms": 1000, "text": "Hello"}]
    assert second == first
    assert calls == [("Song", "Artist", "Album")]


def test_cache_max_entries_evicts_oldest(tmp_path) -> None:
    service = LyricsService(str(tmp_path), timeout_seconds=1.0, max_entries=2)

    service._save("a", "A", "A", "", "[00:01.00]A", None)
    service._save("b", "B", "B", "", "[00:01.00]B", None)
    service._save("c", "C", "C", "", "[00:01.00]C", None)

    assert service._get_cached("a") is None
    assert service._get_cached("b") is not None
    assert service._get_cached("c") is not None


def test_negative_cache_expires_and_retries_remote_lookup(tmp_path, monkeypatch) -> None:
    service = LyricsService(
        str(tmp_path),
        timeout_seconds=1.0,
        max_entries=10,
        negative_cache_ttl_seconds=60.0,
    )
    now = [1000.0]
    monkeypatch.setattr("lyrics.service.time.time", lambda: now[0])

    service._save("missing", "Song", "Artist", "", None, None)
    assert service._get_cached("missing") is not None

    now[0] = 1061.0
    assert service._get_cached("missing") is None

    calls = []

    def fake_fetch(title: str, artist: str, album: str):
        calls.append((title, artist, album))
        return "[00:01.00]Hello", "Hello"

    monkeypatch.setattr(service, "_fetch_remote", fake_fetch)
    result = service.get("Song", "Artist", "")

    assert result["synced"] is True
    assert calls == [("Song", "Artist", "")]
