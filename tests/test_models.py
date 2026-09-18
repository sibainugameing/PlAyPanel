from __future__ import annotations

import core.models as models
from core.models import TrackMetadata, rtp_delta


def test_rtp_delta_wraps_32_bit_counter() -> None:
    assert rtp_delta(2**32 - 10, 5) == 15


def test_progress_uses_rtp_duration_when_available() -> None:
    state = TrackMetadata()
    state.set_progress(100, 44200, 88300)

    assert state.duration_seconds() == 88200 / 44100
    assert state.progress_elapsed_seconds == 44100 / 44100


def test_progress_ratio_is_clamped_to_duration(monkeypatch) -> None:
    state = TrackMetadata(playing=True)
    monkeypatch.setattr(models.time, "monotonic", lambda: 100.0)
    state.set_progress(0, 44100, 88200)
    monkeypatch.setattr(models.time, "monotonic", lambda: 103.0)

    assert state.current_elapsed_seconds() == 2.0
    assert state.progress_ratio() == 1.0


def test_freeze_and_resume_preserve_elapsed_position(monkeypatch) -> None:
    now = [10.0]
    monkeypatch.setattr(models.time, "monotonic", lambda: now[0])

    state = TrackMetadata(playing=True)
    state.set_progress(0, 0, 441000)

    now[0] = 13.0
    frozen = state.current_elapsed_seconds()
    state.freeze_progress()

    assert frozen == 3.0
    assert state.progress_elapsed_seconds == 3.0
    assert state.progress_anchor_monotonic is None

    now[0] = 20.0
    state.playing = True
    state.resume_progress()
    assert state.progress_anchor_monotonic == 20.0


def test_as_dict_exposes_progress_contract(monkeypatch) -> None:
    monkeypatch.setattr(models.time, "monotonic", lambda: 50.0)
    state = TrackMetadata(title="T", artist="A", playing=True, connected=True)
    state.set_progress(0, 44100, 88200)

    data = state.as_dict()

    assert data["title"] == "T"
    assert data["artist"] == "A"
    assert data["connected"] is True
    assert data["progress"]["available"] is True
    assert data["progress"]["elapsed_seconds"] == 1.0
    assert data["progress"]["duration_seconds"] == 2.0
    assert data["progress"]["ratio"] == 0.5
