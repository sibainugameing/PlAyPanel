from __future__ import annotations

import base64
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Iterator


DEFAULT_PIPE = Path("/tmp/shairport-sync-metadata")


@dataclass
class TrackMetadata:
    title: str = ""
    artist: str = ""
    album: str = ""
    album_artist: str = ""
    genre: str = ""
    composer: str = ""
    artwork: bytes | None = None
    playing: bool | None = None
    client_name: str = ""

    def as_dict(self) -> dict:
        return {
            "title": self.title,
            "artist": self.artist,
            "album": self.album,
            "album_artist": self.album_artist,
            "genre": self.genre,
            "composer": self.composer,
            "has_artwork": self.artwork is not None,
            "playing": self.playing,
            "client_name": self.client_name,
        }


ITEM_RE = re.compile(
    rb"<item><type>([0-9a-fA-F]{8})</type><code>([0-9a-fA-F]{8})</code>"
    rb"<length>([0-9]+)</length>\n?"
)


def fourcc(value: bytes) -> str:
    return int(value, 16).to_bytes(4, "big").decode("latin-1")


def read_item(stream: BinaryIO) -> tuple[str, str, bytes] | None:
    """Read one Shairport Sync metadata item from its XML-like pipe format."""
    line = stream.readline()
    if not line:
        return None

    match = ITEM_RE.match(line)
    if not match:
        return None

    item_type = fourcc(match.group(1))
    code = fourcc(match.group(2))
    length = int(match.group(3))

    if length == 0:
        if not line.rstrip().endswith(b"</item>"):
            stream.readline()
        return item_type, code, b""

    data_header = stream.readline()
    if data_header != b'<data encoding="base64">\n':
        return item_type, code, b""

    encoded_length = 4 * ((length + 2) // 3)
    encoded = stream.read(encoded_length)
    if len(encoded) != encoded_length:
        return None

    try:
        payload = base64.b64decode(encoded, validate=True)
    except ValueError:
        return item_type, code, b""

    stream.readline()
    return item_type, code, payload[:length]


def apply_item(state: TrackMetadata, item: tuple[str, str, bytes]) -> None:
    item_type, code, payload = item

    if item_type == "core":
        text = payload.decode("utf-8", errors="replace").rstrip("\x00")
        if code == "minm":
            state.title = text
        elif code == "asar":
            state.artist = text
        elif code == "asal":
            state.album = text
        elif code == "asaa":
            state.album_artist = text
        elif code == "asgn":
            state.genre = text
        elif code == "ascp":
            state.composer = text
        elif code == "caps" and payload:
            state.playing = payload[0] == 1

    elif item_type == "ssnc":
        text = payload.decode("utf-8", errors="replace").rstrip("\x00")
        if code == "PICT":
            state.artwork = payload
        elif code == "snam":
            state.client_name = text
        elif code == "pbeg" or code == "prsm":
            state.playing = True
        elif code == "pfls":
            state.playing = False
        elif code == "pend" or code == "disc":
            state.playing = False


def metadata_items(stream: BinaryIO) -> Iterator[tuple[str, str, bytes]]:
    while True:
        item = read_item(stream)
        if item is None:
            return
        yield item


def follow_metadata_pipe(pipe: Path = DEFAULT_PIPE) -> Iterator[TrackMetadata]:
    """Follow the Shairport Sync metadata FIFO and reopen it after EOF."""
    state = TrackMetadata()

    while True:
        try:
            with pipe.open("rb", buffering=0) as stream:
                for item in metadata_items(stream):
                    apply_item(state, item)
                    yield state
        except (FileNotFoundError, OSError):
            pass

        time.sleep(1)
