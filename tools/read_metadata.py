from __future__ import annotations

import argparse
from pathlib import Path

from core.metadata import DEFAULT_PIPE, follow_metadata_pipe


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Read Shairport Sync metadata for PlayPanel"
    )
    parser.add_argument(
        "--pipe",
        default=str(DEFAULT_PIPE),
        help=f"Shairport Sync metadata pipe (default: {DEFAULT_PIPE})",
    )
    args = parser.parse_args()
    pipe = Path(args.pipe)

    print(f"Reading Shairport Sync metadata: {pipe}")
    print("Waiting for metadata... (Ctrl+C to stop)")

    last = None
    for state in follow_metadata_pipe(pipe):
        current = (
            state.title,
            state.artist,
            state.album,
            state.album_artist,
            state.playing,
        )
        if current == last:
            continue
        last = current

        print("\n--- Now Playing ---")
        print(f"Title : {state.title or '(unknown)'}")
        print(f"Artist: {state.artist or '(unknown)'}")
        print(f"Album : {state.album or '(unknown)'}")
        if state.album_artist:
            print(f"Album Artist: {state.album_artist}")
        print(f"Playing: {state.playing}")
        if state.artwork is not None:
            print(f"Artwork: {len(state.artwork)} bytes")


if __name__ == "__main__":
    main()
