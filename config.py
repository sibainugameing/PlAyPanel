from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import tomllib


CONFIG_FILE = Path(__file__).with_name("config.toml")


@dataclass(frozen=True)
class PlayPanelConfig:
    host: str = "0.0.0.0"
    port: int = 8765
    artwork_size: int = 520
    panel_max_width: int = 1180
    panel_gap: int = 70
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


def load_config(path: Path = CONFIG_FILE) -> PlayPanelConfig:
    defaults = PlayPanelConfig()

    if not path.exists():
        return defaults

    with path.open("rb") as file:
        raw = tomllib.load(file)

    server = raw.get("server", {})
    layout = raw.get("layout", {})
    appearance = raw.get("appearance", {})
    typography = raw.get("typography", {})
    animation = raw.get("animation", {})
    behavior = raw.get("behavior", {})

    return PlayPanelConfig(
        host=str(server.get("host", defaults.host)),
        port=int(server.get("port", defaults.port)),
        artwork_size=int(layout.get("artwork_size", defaults.artwork_size)),
        panel_max_width=int(layout.get("panel_max_width", defaults.panel_max_width)),
        panel_gap=int(layout.get("panel_gap", defaults.panel_gap)),
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
        artwork_retry_interval_ms=int(
            behavior.get("artwork_retry_interval_ms", defaults.artwork_retry_interval_ms)
        ),
    )
