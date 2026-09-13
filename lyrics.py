from __future__ import annotations

import difflib
import hashlib
import json
import re
import sqlite3
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


LRCLIB_GET_URL = "https://lrclib.net/api/get"
LRCLIB_SEARCH_URL = "https://lrclib.net/api/search"
CACHE_VERSION = "v2"


class LyricsService:
    def __init__(self, cache_dir: str, timeout_seconds: float = 8.0, max_entries: int = 500):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.cache_dir / "lyrics.sqlite3"
        self.timeout_seconds = timeout_seconds
        self.max_entries = max(1, max_entries)
        self._init_db()

    @staticmethod
    def _normalize(value: str) -> str:
        value = (value or "").strip().lower()
        value = re.sub(r"[\u3000\s]+", " ", value)
        return value.strip()

    @classmethod
    def _key(cls, title: str, artist: str, album: str) -> str:
        raw = "\x1f".join((CACHE_VERSION, cls._normalize(artist), cls._normalize(title), cls._normalize(album)))
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @classmethod
    def _similarity(cls, left: str, right: str) -> float:
        return difflib.SequenceMatcher(None, cls._normalize(left), cls._normalize(right)).ratio()

    @classmethod
    def _candidate_score(cls, title: str, artist: str, candidate: dict) -> float:
        candidate_title = str(candidate.get("trackName") or candidate.get("name") or "")
        candidate_artist = str(candidate.get("artistName") or candidate.get("artist") or "")
        title_score = cls._similarity(title, candidate_title)
        artist_score = cls._similarity(artist, candidate_artist)

        normalized_title = cls._normalize(title)
        normalized_candidate_title = cls._normalize(candidate_title)
        normalized_artist = cls._normalize(artist)
        normalized_candidate_artist = cls._normalize(candidate_artist)

        exact_bonus = 0.35 if normalized_title == normalized_candidate_title else 0.0
        artist_bonus = 0.20 if normalized_artist == normalized_candidate_artist else 0.0
        return title_score * 0.65 + artist_score * 0.35 + exact_bonus + artist_bonus

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _init_db(self) -> None:
        with self._connect() as db:
            db.execute(
                """
                CREATE TABLE IF NOT EXISTS lyrics_cache (
                    cache_key TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    artist TEXT NOT NULL,
                    album TEXT NOT NULL,
                    synced_lyrics TEXT,
                    plain_lyrics TEXT,
                    found INTEGER NOT NULL,
                    created_at REAL NOT NULL,
                    last_used REAL NOT NULL
                )
                """
            )
            db.execute("CREATE INDEX IF NOT EXISTS idx_lyrics_last_used ON lyrics_cache(last_used)")
            db.commit()

    def _get_cached(self, key: str) -> dict | None:
        with self._connect() as db:
            row = db.execute("SELECT * FROM lyrics_cache WHERE cache_key = ?", (key,)).fetchone()
            if row is None:
                return None
            now = time.time()
            db.execute("UPDATE lyrics_cache SET last_used = ? WHERE cache_key = ?", (now, key))
            db.commit()
            return dict(row)

    def _save(
        self,
        key: str,
        title: str,
        artist: str,
        album: str,
        synced: str | None,
        plain: str | None,
    ) -> None:
        now = time.time()
        found = int(bool(synced or plain))
        with self._connect() as db:
            db.execute(
                """
                INSERT INTO lyrics_cache
                    (cache_key, title, artist, album, synced_lyrics, plain_lyrics, found, created_at, last_used)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(cache_key) DO UPDATE SET
                    synced_lyrics = excluded.synced_lyrics,
                    plain_lyrics = excluded.plain_lyrics,
                    found = excluded.found,
                    last_used = excluded.last_used
                """,
                (key, title, artist, album, synced, plain, found, now, now),
            )
            db.execute(
                """
                DELETE FROM lyrics_cache
                WHERE cache_key IN (
                    SELECT cache_key FROM lyrics_cache
                    ORDER BY last_used DESC
                    LIMIT -1 OFFSET ?
                )
                """,
                (self.max_entries,),
            )
            db.commit()

    @staticmethod
    def _request_json(url: str, params: dict[str, str]) -> object:
        query = urlencode(params)
        request = Request(
            f"{url}?{query}",
            headers={"User-Agent": "PlayPanel/1.0"},
        )
        with urlopen(request, timeout=8.0) as response:
            if response.status != 200:
                raise RuntimeError(f"LRCLIB HTTP {response.status}")
            return json.loads(response.read().decode("utf-8"))

    def _fetch_exact(self, title: str, artist: str, album: str) -> tuple[str | None, str | None]:
        payload = self._request_json(
            LRCLIB_GET_URL,
            {
                "artist_name": artist,
                "track_name": title,
                "album_name": album,
            },
        )
        if not isinstance(payload, dict):
            raise RuntimeError("Invalid LRCLIB exact response")
        return payload.get("syncedLyrics"), payload.get("plainLyrics")

    def _fetch_search_candidate(self, title: str, artist: str) -> tuple[str | None, str | None] | None:
        payload = self._request_json(
            LRCLIB_SEARCH_URL,
            {"q": f"{artist} {title}"},
        )
        if not isinstance(payload, list):
            raise RuntimeError("Invalid LRCLIB search response")

        candidates = [item for item in payload if isinstance(item, dict)]
        if not candidates:
            return None

        candidates.sort(key=lambda item: self._candidate_score(title, artist, item), reverse=True)
        best = candidates[0]
        score = self._candidate_score(title, artist, best)
        if score < 0.72:
            return None

        synced = best.get("syncedLyrics")
        plain = best.get("plainLyrics")
        if not synced and not plain:
            return None
        return synced, plain

    def get(self, title: str, artist: str, album: str) -> dict:
        title = (title or "").strip()
        artist = (artist or "").strip()
        album = (album or "").strip()

        if not title or not artist:
            return {"found": False, "synced": False, "lines": []}

        key = self._key(title, artist, album)
        cached = self._get_cached(key)
        if cached is not None:
            return self._format_result(cached)

        try:
            synced, plain = self._fetch_exact(title, artist, album)
        except HTTPError as error:
            if error.code == 404:
                try:
                    fallback = self._fetch_search_candidate(title, artist)
                except Exception:
                    fallback = None
                if fallback is not None:
                    synced, plain = fallback
                else:
                    self._save(key, title, artist, album, None, None)
                    cached = self._get_cached(key)
                    return self._format_result(cached or {})
            else:
                return {"found": False, "synced": False, "lines": [], "error": "lookup_failed"}
        except Exception:
            return {"found": False, "synced": False, "lines": [], "error": "lookup_failed"}

        self._save(key, title, artist, album, synced, plain)
        cached = self._get_cached(key)
        return self._format_result(cached or {})

    @staticmethod
    def _parse_lrc(text: str | None) -> list[dict]:
        if not text:
            return []
        lines: list[dict] = []
        for raw_line in text.splitlines():
            matches = list(re.finditer(r"\[(\d+):(\d{1,2})(?:\.(\d{1,3}))?\]", raw_line))
            if not matches:
                continue
            lyric = raw_line[matches[-1].end():].strip()
            for match in matches:
                minutes = int(match.group(1))
                seconds = int(match.group(2))
                fraction = (match.group(3) or "0").ljust(3, "0")[:3]
                milliseconds = int(fraction)
                lines.append({
                    "time_ms": minutes * 60000 + seconds * 1000 + milliseconds,
                    "text": lyric,
                })
        lines.sort(key=lambda item: item["time_ms"])
        return lines

    def _format_result(self, row: dict) -> dict:
        synced = row.get("synced_lyrics") or ""
        plain = row.get("plain_lyrics") or ""
        return {
            "found": bool(row.get("found")),
            "synced": bool(synced),
            "lines": self._parse_lrc(synced),
            "plain": plain,
        }
