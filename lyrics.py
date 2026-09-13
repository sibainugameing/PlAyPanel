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
CACHE_VERSION = "v4"


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
    def _title_variants(cls, title: str) -> list[str]:
        variants: list[str] = []

        def add(value: str) -> None:
            value = value.strip()
            if value and value not in variants:
                variants.append(value)

        add(title)

        feat_match = re.search(
            r"\s*\((?:feat\.?|ft\.?)\s+[^)]*\)\s*$",
            title,
            flags=re.IGNORECASE,
        )
        if feat_match:
            add(title[:feat_match.start()])

        add(re.sub(r"\s*\([^)]*\)\s*$", "", title).strip())
        add(re.sub(r"\s*\[[^\]]*\]\s*$", "", title).strip())
        return variants

    @classmethod
    def _key(cls, title: str, artist: str, album: str) -> str:
        raw = "\x1f".join(
            (
                CACHE_VERSION,
                cls._normalize(artist),
                cls._normalize(title),
                cls._normalize(album),
            )
        )
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @classmethod
    def _similarity(cls, left: str, right: str) -> float:
        return difflib.SequenceMatcher(
            None,
            cls._normalize(left),
            cls._normalize(right),
        ).ratio()

    @classmethod
    def _title_similarity(cls, wanted_title: str, candidate_title: str) -> float:
        candidate = cls._normalize(candidate_title)
        best = 0.0

        for variant in cls._title_variants(wanted_title):
            normalized = cls._normalize(variant)
            score = cls._similarity(normalized, candidate)
            if normalized and (normalized in candidate or candidate in normalized):
                score = max(score, 0.97 if normalized == candidate else 0.90)
            best = max(best, score)

        return best

    @classmethod
    def _candidate_score(
        cls,
        title: str,
        artist: str,
        album: str,
        candidate: dict,
    ) -> tuple[int, float]:
        candidate_title = str(candidate.get("trackName") or candidate.get("name") or "")
        candidate_artist = str(candidate.get("artistName") or candidate.get("artist") or "")
        candidate_album = str(candidate.get("albumName") or candidate.get("album") or "")

        title_score = cls._title_similarity(title, candidate_title)
        artist_score = cls._similarity(artist, candidate_artist)
        album_score = cls._similarity(album, candidate_album) if album and candidate_album else 0.0

        wanted_title_variants = {
            cls._normalize(value) for value in cls._title_variants(title)
        }
        normalized_candidate_title = cls._normalize(candidate_title)
        normalized_artist = cls._normalize(artist)
        normalized_candidate_artist = cls._normalize(candidate_artist)

        exact_title = normalized_candidate_title in wanted_title_variants
        exact_artist = normalized_artist == normalized_candidate_artist
        exact_album = bool(album) and cls._normalize(album) == cls._normalize(candidate_album)
        has_synced = int(bool(candidate.get("syncedLyrics")))

        score = title_score * 0.60 + artist_score * 0.30 + album_score * 0.10
        if exact_title:
            score += 0.25
        if exact_artist:
            score += 0.20
        if exact_album:
            score += 0.05

        return has_synced, score

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
            db.execute(
                "CREATE INDEX IF NOT EXISTS idx_lyrics_last_used ON lyrics_cache(last_used)"
            )
            db.commit()

    def _get_cached(self, key: str) -> dict | None:
        with self._connect() as db:
            row = db.execute(
                "SELECT * FROM lyrics_cache WHERE cache_key = ?",
                (key,),
            ).fetchone()
            if row is None:
                return None

            now = time.time()
            db.execute(
                "UPDATE lyrics_cache SET last_used = ? WHERE cache_key = ?",
                (now, key),
            )
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

    def _request_json(self, url: str, params: dict[str, str]) -> object:
        query = urlencode(params)
        request = Request(
            f"{url}?{query}",
            headers={"User-Agent": "PlayPanel/1.0"},
        )
        with urlopen(request, timeout=self.timeout_seconds) as response:
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

    def _fetch_search_candidate(
        self,
        title: str,
        artist: str,
        album: str,
    ) -> tuple[str | None, str | None] | None:
        variants = self._title_variants(title)
        search_title = min(variants, key=lambda value: len(self._normalize(value)))

        payload = self._request_json(
            LRCLIB_SEARCH_URL,
            {"q": f"{artist} {search_title}"},
        )
        if not isinstance(payload, list):
            raise RuntimeError("Invalid LRCLIB search response")

        candidates = [item for item in payload if isinstance(item, dict)]
        if not candidates:
            return None

        # Select by title/artist similarity first, then prefer synced lyrics.
        candidates.sort(
            key=lambda item: self._candidate_score(title, artist, album, item),
            reverse=True,
        )

        wanted_artist = self._normalize(artist)
        matching_artist = [
            item
            for item in candidates
            if self._normalize(
                str(item.get("artistName") or item.get("artist") or "")
            )
            == wanted_artist
        ]
        pool = matching_artist or candidates

        scored_candidates = []
        for candidate in pool:
            has_synced, score = self._candidate_score(title, artist, album, candidate)
            if score >= 0.72:
                scored_candidates.append((has_synced, score, candidate))

        # A synced result is more useful than an otherwise similar plain-only
        # result. Keep similarity as the secondary criterion.
        scored_candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)

        for _has_synced, _score, candidate in scored_candidates:
            synced = candidate.get("syncedLyrics")
            plain = candidate.get("plainLyrics")
            track_id = candidate.get("id")

            # Search results can omit lyric fields. Resolve the selected track
            # by its LRCLIB id so that synchronized lyrics are not discarded.
            if track_id is not None:
                try:
                    resolved = self._request_json(
                        LRCLIB_GET_URL,
                        {"id": str(track_id)},
                    )
                    if isinstance(resolved, dict):
                        synced = resolved.get("syncedLyrics") or synced
                        plain = resolved.get("plainLyrics") or plain
                except Exception:
                    pass

            if synced or plain:
                return synced, plain

        return None

    def _fetch_remote(
        self,
        title: str,
        artist: str,
        album: str,
    ) -> tuple[str | None, str | None]:
        # Album metadata from streaming services often differs from LRCLIB,
        # so exact lookup is attempted first but search is the fallback.
        try:
            synced, plain = self._fetch_exact(title, artist, album)
            if synced or plain:
                return synced, plain
        except HTTPError as error:
            if error.code != 404:
                raise

        fallback = self._fetch_search_candidate(title, artist, album)
        if fallback is None:
            return None, None
        return fallback

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
            synced, plain = self._fetch_remote(title, artist, album)
        except Exception:
            return {
                "found": False,
                "synced": False,
                "lines": [],
                "error": "lookup_failed",
            }

        self._save(key, title, artist, album, synced, plain)
        cached = self._get_cached(key)
        return self._format_result(cached or {})

    @staticmethod
    def _parse_lrc(text: str | None) -> list[dict]:
        if not text:
            return []

        lines: list[dict] = []
        for raw_line in text.splitlines():
            matches = list(
                re.finditer(
                    r"\[(\d+):(\d{1,2})(?:\.(\d{1,3}))?\]",
                    raw_line,
                )
            )
            if not matches:
                continue

            lyric = raw_line[matches[-1].end():].strip()
            for match in matches:
                minutes = int(match.group(1))
                seconds = int(match.group(2))
                fraction = (match.group(3) or "0").ljust(3, "0")[:3]
                milliseconds = int(fraction)
                lines.append(
                    {
                        "time_ms": minutes * 60000 + seconds * 1000 + milliseconds,
                        "text": lyric,
                    }
                )

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
