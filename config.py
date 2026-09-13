from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import tomllib


CONFIG_FILE = Path(__file__).with_name("config.toml")


BACKGROUND_PRESETS = {
    "black": "0, 0, 0",
    "graphite": "18, 18, 20",
    "slate": "27, 32, 38",
    "midnight": "8, 15, 28",
    "navy": "10, 24, 48",
    "purple": "28, 12, 42",
    "wine": "42, 12, 20",
    "forest": "10, 28, 20",
    "teal": "8, 30, 30",
    "warm": "42, 28, 18",
    "paper": "232, 230, 224",
}


@dataclass(frozen=True)
class PlayPanelConfig:
    host: str = "0.0.0.0"
    port: int = 8765
    artwork_size: int = 520
    panel_max_width: int = 1180
    panel_gap: int = 70
    background_mode: str = "artwork_blur"
    background_preset: str = "black"
    background_rgb: str = "0, 0, 0"
    background_artwork_opacity: float = 0.46
    background_artwork_blur: int = 52
    background_color: str = "#080808"
    text_color: str = "#f5f5f5"
    muted_color: str = "rgba(245, 245, 245, 0.58)"
    title_size: str = "clamp(2.8rem, 5.6vw, 6rem)"
    artist_size: str = "clamp(1.35rem, 2.25vw, 2.15rem)"
    album_size: str = "1rem"
    animations_enabled: bool = True
    record_rotation_enabled: bool = True
    record_rotation_speed: float = 18.0
    record_change_enabled: bool = True
    record_change_duration: int = 760
    record_change_distance: int = 120
    record_change_rotation: float = 22.0
    info_change_enabled: bool = True
    info_change_duration: int = 420
    info_change_distance: int = 16
    animation_easing: str = "cubic-bezier(0.22, 1, 0.36, 1)"
    poll_interval_ms: int = 1000
    artwork_retry_interval_ms: int = 3000
    lyrics_enabled: bool = True
    lyrics_cache_dir: str = "lyrics_cache"
    lyrics_cache_max_entries: int = 500
    lyrics_timeout_seconds: float = 8.0
    lyrics_visible_lines: int = 5
    lyrics_current_size: str = "2.4rem"
    lyrics_side_size: str = "1.15rem"
    clock_enabled: bool = True
    screen_blank_enabled: bool = True
    screen_blank_timeout_minutes: int = 30


def load_config(path: Path = CONFIG_FILE) -> PlayPanelConfig:
    defaults = PlayPanelConfig()
    if not path.exists():
        return defaults

    with path.open("rb") as file:
        raw = tomllib.load(file)

    server = raw.get("server", {})
    layout = raw.get("layout", {})
    background = raw.get("background", {})
    appearance = raw.get("appearance", {})
    typography = raw.get("typography", {})
    animation = raw.get("animation", {})
    behavior = raw.get("behavior", {})
    lyrics = raw.get("lyrics", {})
    display = raw.get("display", {})

    background_mode = str(background.get("mode", defaults.background_mode)).strip().lower()
    background_preset = str(background.get("preset", defaults.background_preset)).strip().lower()
    background_rgb = str(background.get("rgb", defaults.background_rgb)).strip()

    if background_preset in BACKGROUND_PRESETS:
        resolved_preset_rgb = BACKGROUND_PRESETS[background_preset]
    else:
        background_preset = defaults.background_preset
        resolved_preset_rgb = BACKGROUND_PRESETS[background_preset]

    if background_mode not in {"artwork_blur", "preset", "rgb"}:
        background_mode = defaults.background_mode

    if background_mode == "preset":
        resolved_background_rgb = resolved_preset_rgb
    else:
        resolved_background_rgb = background_rgb

    return PlayPanelConfig(
        host=str(server.get("host", defaults.host)),
        port=int(server.get("port", defaults.port)),
        artwork_size=int(layout.get("artwork_size", defaults.artwork_size)),
        panel_max_width=int(layout.get("panel_max_width", defaults.panel_max_width)),
        panel_gap=int(layout.get("panel_gap", defaults.panel_gap)),
        background_mode=background_mode,
        background_preset=background_preset,
        background_rgb=resolved_background_rgb,
        background_artwork_opacity=float(background.get("artwork_opacity", defaults.background_artwork_opacity)),
        background_artwork_blur=int(background.get("artwork_blur", defaults.background_artwork_blur)),
        background_color=str(appearance.get("background_color", defaults.background_color)),
        text_color=str(appearance.get("text_color", defaults.text_color)),
        muted_color=str(appearance.get("muted_color", defaults.muted_color)),
        title_size=str(typography.get("title_size", defaults.title_size)),
        artist_size=str(typography.get("artist_size", defaults.artist_size)),
        album_size=str(typography.get("album_size", defaults.album_size)),
        animations_enabled=bool(animation.get("enabled", defaults.animations_enabled)),
        record_rotation_enabled=bool(animation.get("record_rotation_enabled", defaults.record_rotation_enabled)),
        record_rotation_speed=float(animation.get("record_rotation_speed", defaults.record_rotation_speed)),
        record_change_enabled=bool(animation.get("record_change_enabled", defaults.record_change_enabled)),
        record_change_duration=int(animation.get("record_change_duration", defaults.record_change_duration)),
        record_change_distance=int(animation.get("record_change_distance", defaults.record_change_distance)),
        record_change_rotation=float(animation.get("record_change_rotation", defaults.record_change_rotation)),
        info_change_enabled=bool(animation.get("info_change_enabled", defaults.info_change_enabled)),
        info_change_duration=int(animation.get("info_change_duration", defaults.info_change_duration)),
        info_change_distance=int(animation.get("info_change_distance", defaults.info_change_distance)),
        animation_easing=str(animation.get("easing", defaults.animation_easing)),
        poll_interval_ms=int(behavior.get("poll_interval_ms", defaults.poll_interval_ms)),
        artwork_retry_interval_ms=int(behavior.get("artwork_retry_interval_ms", defaults.artwork_retry_interval_ms)),
        lyrics_enabled=bool(lyrics.get("enabled", defaults.lyrics_enabled)),
        lyrics_cache_dir=str(lyrics.get("cache_dir", defaults.lyrics_cache_dir)),
        lyrics_cache_max_entries=int(lyrics.get("cache_max_entries", defaults.lyrics_cache_max_entries)),
        lyrics_timeout_seconds=float(lyrics.get("timeout_seconds", defaults.lyrics_timeout_seconds)),
        lyrics_visible_lines=int(lyrics.get("visible_lines", defaults.lyrics_visible_lines)),
        lyrics_current_size=str(lyrics.get("current_line_size", defaults.lyrics_current_size)),
        lyrics_side_size=str(lyrics.get("side_line_size", defaults.lyrics_side_size)),
        clock_enabled=bool(display.get("clock_enabled", defaults.clock_enabled)),
        screen_blank_enabled=bool(display.get("screen_blank_enabled", defaults.screen_blank_enabled)),
        screen_blank_timeout_minutes=int(display.get("screen_blank_timeout_minutes", defaults.screen_blank_timeout_minutes)),
    )
