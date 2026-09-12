from __future__ import annotations

import base64
import binascii
import os
import re
import time
from pathlib import Path
from typing import BinaryIO, Iterator

from models import TrackMetadata


DEFAULT_PIPE = Path(
    os.environ.get("PLAYPANEL_METADATA_PIPE", "/tmp/shairport-sync-metadata")
)


HEADER_PATTERN = re.compile(
    r"^<item><type>"
    r"([0-9A-Fa-f]{8})"
    r"</type><code>"
    r"([0-9A-Fa-f]{8})"
    r"</code><length>"
    r"([0-9]+)"
    r"</length>"
    r"(?:</item>)?$"
)


def hex_to_code(value: str) -> str:
    try:
        return bytes.fromhex(value).decode("ascii", errors="replace")
    except Exception:
        return value


def parse_header(line: str) -> tuple[str, str, int] | None:
    match = HEADER_PATTERN.match(line)
    if match is None:
        return None

    return (
        hex_to_code(match.group(1)),
        hex_to_code(match.group(2)),
        int(match.group(3)),
    )


def decode_base64(data: bytes) -> bytes:
    if not data:
        return b""

    try:
        return base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError) as exc:
        print(f"Base64 decode error: {exc}", flush=True)
        return b""


def detect_image_type(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    return None


def read_metadata_item(stream: BinaryIO) -> tuple[str, str, int, bytes] | None:
    header_bytes = stream.readline()
    if not header_bytes:
        return None

    header = header_bytes.decode("ascii", errors="replace").rstrip("\r\n")
    if not header:
        return None

    parsed = parse_header(header)
    if parsed is None:
        print(f"Unknown metadata header: {header[:300]!r}", flush=True)
        return None

    type_code, metadata_code, declared_length = parsed

    if declared_length == 0:
        return type_code, metadata_code, 0, b""

    data_tag = stream.readline()
    if not data_tag:
        return None

    data_tag = data_tag.decode("ascii", errors="replace").rstrip("\r\n")
    if data_tag != '<data encoding="base64">':
        print(
            f"Unexpected data tag for {metadata_code}: {data_tag!r}",
            flush=True,
        )
        return None

    expected_b64_length = 4 * ((declared_length + 2) // 3)
    payload_b64 = bytearray()

    while len(payload_b64) < expected_b64_length:
        chunk = stream.read(expected_b64_length - len(payload_b64))
        if not chunk:
            print(
                f"Unexpected EOF while reading {metadata_code} payload.",
                flush=True,
            )
            return None
        payload_b64.extend(chunk)

    end_tag = stream.readline()
    if not end_tag:
        return None

    end_tag = end_tag.decode("ascii", errors="replace").rstrip("\r\n")
    if end_tag != "</data></item>":
        print(
            f"Unexpected metadata end tag for {metadata_code}: {end_tag!r}",
            flush=True,
        )
        return None

    payload = decode_base64(bytes(payload_b64))
    if len(payload) != declared_length:
        print(
            "Decoded length mismatch: "
            f"code={metadata_code} "
            f"declared={declared_length} "
            f"decoded={len(payload)}",
            flush=True,
        )
        return None

    return type_code, metadata_code, declared_length, payload


def _metadata_text(payload: bytes) -> str:
    return payload.decode("utf-8", errors="replace").rstrip("\x00")


def _fallback_track_id(state: TrackMetadata) -> str:
    value = "\x1f".join([state.title, state.artist, state.album]).strip("\x1f")
    return f"fallback:{value}" if value else ""


def apply_item(state: TrackMetadata, item: tuple[str, str, int, bytes]) -> None:
    _type_code, code, declared_length, payload = item

    if code in {"pcst", "pcen"}:
        return

    if code == "stal":
        print("WARNING: metadata transfer stalled.", flush=True)
        return

    if code == "PICT":
        if declared_length == 0:
            return
        if detect_image_type(payload) is not None:
            state.artwork = payload
            state.artwork_track_id = state.track_id
        else:
            print(
                f"Unknown cover image format ({len(payload)} bytes)",
                flush=True,
            )
        return

    if code == "mper":
        new_track_id = _metadata_text(payload)
        if new_track_id and new_track_id != state.track_id:
            old_artwork_track_id = state.artwork_track_id
            state.track_id = new_track_id

            if state.artwork is not None and old_artwork_track_id == "":
                state.artwork_track_id = new_track_id
            elif state.artwork is not None and old_artwork_track_id != new_track_id:
                state.artwork = None
                state.artwork_track_id = ""
        return

    # AirPlay 2 connection lifecycle messages.
    if code == "conn":
        state.connected = True
        return

    if code == "disc":
        state.connected = False
        state.playing = False
        return

    # These messages are useful for classic AirPlay sessions too.
    if code in {"pbeg", "prsm"}:
        state.connected = True
        state.playing = True
        return

    if code in {"pend", "aend", "pfls"}:
        state.playing = False
        return

    if code == "clip":
        state.connected = True
        return

    if code in {"minm", "asar", "asal", "asaa", "asgn", "ascp", "snam"}:
        value = _metadata_text(payload)

        if code == "minm":
            state.title = value
        elif code == "asar":
            state.artist = value
        elif code == "asal":
            state.album = value
        elif code == "asaa":
            state.album_artist = value
        elif code == "asgn":
            state.genre = value
        elif code == "ascp":
            state.composer = value
        elif code == "snam":
            state.client_name = value

        if not state.track_id or state.track_id.startswith("fallback:"):
            state.track_id = _fallback_track_id(state)
        if state.artwork is not None and not state.artwork_track_id and state.track_id:
            state.artwork_track_id = state.track_id
        return

    if code == "caps" and payload:
        state.playing = payload[0] == 1


def metadata_items(stream: BinaryIO) -> Iterator[tuple[str, str, int, bytes]]:
    while True:
        item = read_metadata_item(stream)
        if item is None:
            return
        yield item


def follow_metadata_pipe(pipe: Path = DEFAULT_PIPE) -> Iterator[TrackMetadata]:
    state = TrackMetadata()

    while True:
        try:
            with pipe.open("rb", buffering=0) as stream:
                print(f"Metadata pipe connected: {pipe}", flush=True)
                yield state

                for item in metadata_items(stream):
                    apply_item(state, item)
                    yield state

                state.connected = False
                print("Metadata pipe disconnected.", flush=True)
                yield state
        except (FileNotFoundError, PermissionError, OSError) as exc:
            state.connected = False
            print(f"Metadata pipe error: {exc}", flush=True)

        time.sleep(1)
