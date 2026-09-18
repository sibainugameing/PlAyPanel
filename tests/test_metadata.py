from __future__ import annotations

from io import BytesIO

from core.metadata import apply_item, parse_header, read_metadata_item, detect_image_type
from core.models import TrackMetadata


def make_item(code_hex: str, payload: bytes, type_hex: str = "73736e63") -> bytes:
    header = (
        f"<item><type>{type_hex}</type><code>{code_hex}</code>"
        f"<length>{len(payload)}</length></item>\n"
    )
    import base64
    encoded = base64.b64encode(payload).decode("ascii")
    return (
        header
        + '<data encoding="base64">\n'
        + encoded
        + "\n</data></item>\n"
    ).encode("ascii")


def test_parse_header_decodes_hex_codes() -> None:
    assert parse_header("<item><type>73736e63</type><code>6d696e6d</code><length>4</length>") == (
        "ssnc",
        "minm",
        4,
    )


def test_read_metadata_item_decodes_payload() -> None:
    stream = BytesIO(make_item("6d696e6d", b"Test"))
    assert read_metadata_item(stream) == ("ssnc", "minm", 4, b"Test")


def test_read_metadata_item_rejects_invalid_end_tag() -> None:
    stream = BytesIO(
        b'<item><type>73736e63</type><code>6d696e6d</code><length>3</length></item>\n'
        b'<data encoding="base64">\nYWJj\n</data></item>\n'
    )
    stream.seek(0)
    assert read_metadata_item(stream) == ("ssnc", "minm", 3, b"abc")


def test_apply_metadata_populates_track_fields() -> None:
    state = TrackMetadata()

    apply_item(state, ("ssnc", "minm", 5, b"Title"))
    apply_item(state, ("ssnc", "asar", 6, b"Artist"))
    apply_item(state, ("ssnc", "asal", 5, b"Album"))

    assert state.title == "Title"
    assert state.artist == "Artist"
    assert state.album == "Album"
    assert state.track_id.startswith("fallback:")


def test_apply_progress_and_duration() -> None:
    state = TrackMetadata()
    apply_item(state, ("ssnc", "astm", 4, (120000).to_bytes(4, "big")))
    apply_item(state, ("ssnc", "prgr", 0, b"100/44200/44200"))

    assert state.song_duration_seconds == 120.0
    assert state.progress_start_rtp == 100
    assert state.progress_current_rtp == 44200
    assert state.progress_end_rtp == 44200


def test_track_change_resets_progress_and_stale_artwork() -> None:
    state = TrackMetadata(track_id="old", artwork=b"not-relevant", artwork_track_id="old")
    state.playing = True
    apply_item(state, ("ssnc", "prgr", 0, b"100/200/300"))
    apply_item(state, ("ssnc", "mper", 3, b"new"))

    assert state.track_id == "new"
    assert state.progress_start_rtp is None
    assert state.progress_current_rtp is None
    assert state.progress_end_rtp is None
    assert state.artwork is None
    assert state.artwork_track_id == ""


def test_image_type_detection() -> None:
    assert detect_image_type(b"\xff\xd8\xffanything") == "image/jpeg"
    assert detect_image_type(b"\x89PNG\r\n\x1a\nanything") == "image/png"
    assert detect_image_type(b"GIF89a") is None
