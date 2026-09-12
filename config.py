from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import tomllib


CONFIG_FILE = Path(__file__).with_name("config.toml")


@dataclass(frozen=True)
class PlayPanelConfig:
    artwork_size: int = 460
    panel_max_width: int = 1100
    panel_gap: int = 48
    background_color: str = "#111111"
    text_color: str = "#ffffff"
    accent_color: str = "#ffffff"
    title_size: str = "clamp(2.4rem, 5vw, 5rem)"
    artist_size: str = "clamp(1.4rem, 2.5vw, 2.2rem)"
    album_size: str = "1rem"
    poll_interval_ms: int = 1000


def load_config(path: Path = CONFIG_FILE) -> PlayPanelConfig:
    values = PlayPanelConfig()

    if not path.exists():
        return values

    with path.open("rb") as file:
        raw = tomllib.load(file)

    appearance = raw.get("appearance", {})
    layout = raw.get("layout", {})
    text = raw.get("text", {})
    behavior = raw.get("behavior", {})

    return PlayPanelConfig(
        artwork_size=int(layout.get("artwork_size", values.artwork_size)),
        panel_max_width=int(layout.get("panel_max_width", values.panel_max_width)),
        panel_gap=int(layout.get("panel_gap", values.panel_gap)),
        background_color=str(appearance.get("background_color", values.background_color)),
        text_color=str(appearance.get("text_color", values.text_color)),
        accent_color=str(appearance.get("accent_color", values.accent_color)),
        title_size=str(text.get("title_size", values.title_size)),
        artist_size=str(text.get("artist_size", values.artist_size)),
        album_size=str(text.get("album_size", values.album_size)),
        poll_interval_ms=int(behavior.get("poll_interval_ms", values.poll_interval_ms)),
    )
