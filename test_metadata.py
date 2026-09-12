from __future__ import annotations

import argparse
import base64
import os
import struct
import time
import zlib
from pathlib import Path


DEFAULT_PIPE = Path("/tmp/shairport-sync-metadata")

TRACKS = [
    {
        "id": "playpanel-test-01",
        "title": "PlayPanel Test Track",
        "artist": "PlayPanel",
        "album": "README Demo",
    },
    {
        "id": "playpanel-test-02",
        "title": "Second Test Track",
        "artist": "PlayPanel",
        "album": "README Demo",
    },
    {
        "id": "playpanel-test-03",
        "title": "Album Art Test",
        "artist": "PlayPanel",
        "album": "README Demo",
    },
]


def png_bytes(seed: int) -> bytes:
    width = height = 256
    rows = []

    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            r = (x + seed * 35) % 256
            g = (y * 2 + seed * 55) % 256
            b = ((x + y) // 2 + seed * 75) % 256
            row.extend((r, g, b))
        rows.append(bytes(row))

    raw = b"".join(rows)

    def chunk(kind: bytes, payload: bytes) -> bytes:
        crc = zlib.crc32(kind + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", crc)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def item(metadata_code: str, payload: bytes) -> bytes:
    type_hex = b"ssnc".hex().upper()
    code_hex = metadata_code.encode("ascii").hex().upper()
    header = (
        f"<item><type>{type_hex}</type><code>{code_hex}</code>"
        f"<length>{len(payload)}</length></item>\n"
    ).encode("ascii")

    if not payload:
        return header

    encoded = base64.b64encode(payload)
    return header + b'<data encoding="base64">\n' + encoded + b"\n</data></item>\n"


def send_track(stream, track: dict, artwork: bytes) -> None:
    print(f"Sending: {track['title']} — {track['artist']}", flush=True)

    stream.write(item("mper", track["id"].encode("utf-8")))
    stream.write(item("minm", track["title"].encode("utf-8")))
    stream.write(item("asar", track["artist"].encode("utf-8")))
    stream.write(item("asal", track["album"].encode("utf-8")))
    stream.write(item("PICT", artwork))
    stream.write(item("pbeg", b""))
    stream.flush()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Send fake Shairport Sync metadata to PlayPanel for README screenshots."
    )
    parser.add_argument("--pipe", type=Path, default=DEFAULT_PIPE)
    parser.add_argument("--interval", type=float, default=8.0)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()

    if not args.pipe.exists():
        try:
            os.mkfifo(args.pipe)
        except FileExistsError:
            pass
        print(f"Created metadata FIFO: {args.pipe}", flush=True)

    print("PlayPanel test metadata sender", flush=True)
    print(f"FIFO: {args.pipe}", flush=True)
    print("Stop with Ctrl+C.", flush=True)
    print("Use only when the real Shairport Sync metadata pipe is not in use.", flush=True)

    with args.pipe.open("wb", buffering=0) as stream:
        for index, track in enumerate(TRACKS, start=1):
            send_track(stream, track, png_bytes(index))

            if args.once:
                break

            time.sleep(args.interval)

            stream.write(item("pend", b""))
            stream.flush()
            time.sleep(1)

        print("Test sequence finished. Keeping FIFO open until Ctrl+C.", flush=True)
        while True:
            time.sleep(1)


if __name__ == "__main__":
    main()
