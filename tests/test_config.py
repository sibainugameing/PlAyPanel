from __future__ import annotations

from pathlib import Path

from config import PlayPanelConfig, load_config


def test_load_config_missing_file_returns_defaults(tmp_path: Path) -> None:
    defaults = PlayPanelConfig()
    loaded = load_config(tmp_path / "missing.toml")
    assert loaded == defaults


def test_load_config_reads_core_sections(tmp_path: Path) -> None:
    config_file = tmp_path / "config.toml"
    config_file.write_text(
        """
[server]
host = "127.0.0.1"
port = 9000

[layout]
artwork_size = 640

[lyrics]
enabled = false
visible_lines = 7
sync_offset_seconds = -0.5

[display]
clock_enabled = false
screen_blank_enabled = false
screen_blank_timeout_minutes = 45
""".strip()
        + "\n",
        encoding="utf-8",
    )

    loaded = load_config(config_file)

    assert loaded.host == "127.0.0.1"
    assert loaded.port == 9000
    assert loaded.artwork_size == 640
    assert loaded.lyrics_enabled is False
    assert loaded.lyrics_visible_lines == 7
    assert loaded.lyrics_sync_offset_seconds == -0.5
    assert loaded.clock_enabled is False
    assert loaded.screen_blank_enabled is False
    assert loaded.screen_blank_timeout_minutes == 45
