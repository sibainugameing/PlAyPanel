# PlayPanel

A lightweight web dashboard that turns Shairport Sync metadata into a clean, record-inspired now-playing display.

PlayPanel is designed for AirPlay receiver setups where **Shairport Sync handles the audio** and PlayPanel focuses on presenting track information and album artwork in a browser.

![PlayPanel main screen](https://github.com/user-attachments/assets/2481690a-2072-483b-8b05-bcb3d4187c2e)

## Features

- AirPlay now-playing metadata via Shairport Sync
- Large title, artist, and album display
- Album artist, genre, and composer metadata support
- Album artwork display with track/artwork synchronization
- Automatic artwork retries when artwork arrives later than track metadata
- Record-style album artwork presentation
- Record rotation while playback is active
- Animated record replacement when the track changes
- Long-title handling for Japanese and other scripts
- Optional clock display
- Optional browser-based screen blanking after inactivity
- Responsive layout for desktop and other browser sizes
- Access from another device on the same LAN
- Configuration through `config.toml`

## How it works

```text
iPhone / AirPlay
       |
       v
 Shairport Sync
       |
       | metadata
       v
 metadata FIFO
       |
       v
   PlayPanel
       |
       v
    Browser
```

PlayPanel does **not** process AirPlay audio itself. Shairport Sync is responsible for receiving and playing the audio. PlayPanel reads the metadata exposed by Shairport Sync and serves the UI over HTTP.

---

# Requirements

- Linux (Debian/Ubuntu-based systems are recommended)
- Python 3.11+
- Shairport Sync with metadata output enabled
- A browser for the PlayPanel UI

---

# Installation

## 1. Configure Shairport Sync metadata

By default, PlayPanel reads:

```text
/tmp/shairport-sync-metadata
```

Enable Shairport Sync metadata output and cover art. For example:

```text
metadata {
    enabled=yes;
    include_cover_art=yes;
    pipe_name=/tmp/shairport-sync-metadata;
}
```

The exact Shairport Sync configuration file location depends on your Linux distribution.

## 2. Clone PlayPanel

```bash
git clone https://github.com/sibainugameing/PlAyPanel.git
cd PlAyPanel
```

To update an existing checkout:

```bash
cd ~/PlayPanel
git pull
```

## 3. Create the Python environment

```bash
sudo apt update
sudo apt install -y python3 python3-venv

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 4. Check the metadata path

The default metadata FIFO is:

```text
/tmp/shairport-sync-metadata
```

You can override it with the `PLAYPANEL_METADATA_PIPE` environment variable.

## 5. Start PlayPanel

```bash
source .venv/bin/activate
python app.py
```

Open:

```text
http://127.0.0.1:8765/
```

To access it from another device on the same LAN:

```text
http://<server-ip>:8765/
```

The default server configuration is:

```toml
[server]
host = "0.0.0.0"
port = 8765
```

---

# Optional: Run PlayPanel as a systemd service

For a dedicated receiver or always-on display, running PlayPanel under systemd is recommended.

Create:

```text
/etc/systemd/system/playpanel.service
```

Example:

```ini
[Unit]
Description=PlayPanel Shairport metadata web server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/PlayPanel
ExecStart=/home/YOUR_USERNAME/PlayPanel/.venv/bin/python /home/YOUR_USERNAME/PlayPanel/app.py
Restart=always
RestartSec=3
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now playpanel.service
```

Check the service:

```bash
systemctl status playpanel.service
```

View live logs:

```bash
journalctl -u playpanel.service -f
```

---

# Testing without AirPlay

`test_metadata.py` can generate Shairport Sync-style metadata without requiring an actual AirPlay device.

It uses a separate FIFO so it does not interfere with the real Shairport Sync metadata pipe.

### Terminal 1

```bash
cd ~/PlayPanel
source .venv/bin/activate
PLAYPANEL_METADATA_PIPE=/tmp/playpanel-test-metadata python app.py
```

### Terminal 2

```bash
cd ~/PlayPanel
source .venv/bin/activate
python test_metadata.py
```

The test sender cycles through sample tracks and album artwork.

Open:

```text
http://127.0.0.1:8765/
```

The test FIFO is:

```text
/tmp/playpanel-test-metadata
```

It is intentionally separate from the production FIFO:

```text
/tmp/shairport-sync-metadata
```

---

# Configuration

All main settings are stored in `config.toml`. Restart PlayPanel after changing the configuration.

## Server

```toml
[server]
host = "0.0.0.0"
port = 8765
```

## Layout

```toml
[layout]
artwork_size = 520
panel_max_width = 1180
panel_gap = 70
```

## Appearance

```toml
[appearance]
background_color = "#080808"
text_color = "#f5f5f5"
muted_color = "rgba(245, 245, 245, 0.58)"
```

## Typography

```toml
[typography]
title_size = "clamp(2.8rem, 5.6vw, 6rem)"
artist_size = "clamp(1.35rem, 2.25vw, 2.15rem)"
album_size = "1rem"
```

## Animation

```toml
[animation]
enabled = true
record_rotation_enabled = true
record_rotation_speed = 2.0
record_change_enabled = true
record_change_duration = 1200
record_change_distance = 105
record_change_rotation = 10.0
info_change_enabled = true
info_change_duration = 650
info_change_distance = 10
easing = "cubic-bezier(0.25, 0.85, 0.3, 1)"
```

## Browser behavior

```toml
[behavior]
poll_interval_ms = 1000
artwork_retry_interval_ms = 3000
```

## Clock and screen blanking

```toml
[display]
clock_enabled = true
screen_blank_enabled = true
screen_blank_timeout_minutes = 30
```

`screen_blank_enabled` adds a black browser overlay after inactivity. It does not power off the physical display or control DPMS.

---

# API

## `GET /now-playing.json`

Returns the latest metadata state.

Example:

```json
{
  "title": "Track Title",
  "artist": "Artist",
  "album": "Album",
  "album_artist": "",
  "genre": "",
  "composer": "",
  "has_artwork": true,
  "artwork_track_id": "track-id",
  "playing": true,
  "connected": true,
  "client_name": "",
  "track_id": "track-id"
}
```

## `GET /artwork?track_id=<track_id>`

Returns the artwork associated with the requested track ID.

PlayPanel verifies that the requested track ID matches the current artwork track ID. This prevents a stale cover from being displayed for a newly changed track.

---

# Architecture

```text
                         AirPlay
                            |
                            v
                     Shairport Sync
                            |
                            | metadata
                            v
              /tmp/shairport-sync-metadata
                            |
                            v
                       metadata.py
                            |
                            v
                  metadata_service.py
                            |
                            v
                         app.py
                      /          \
                     /            \
                    v              v
          /now-playing.json      /artwork
                    \              /
                     \            /
                      v          v
                       Web Browser
                            |
                    app.js / style.css
```

Configuration follows this path:

```text
config.toml
     |
     v
 config.py
     |
     v
 PlayPanelConfig
     |
     v
 index.html
     |
     +--> CSS variables
     +--> JavaScript configuration
```

## `metadata.py`

Reads and parses the Shairport Sync metadata FIFO.

The parser handles Shairport Sync metadata records, including Base64-encoded payloads and the following commonly used metadata codes:

| Code | Meaning |
| --- | --- |
| `minm` | Track title |
| `asar` | Artist |
| `asal` | Album |
| `asaa` | Album artist |
| `asgn` | Genre |
| `ascp` | Composer |
| `PICT` | Artwork |
| `snam` | Client name |
| `mper` | Persistent track ID |
| `pbeg` / `prsm` | Playback start / resume |
| `pend` / `aend` / `pfls` / `disc` | Playback/session end or stop events |

Track IDs and artwork IDs are kept associated so that an artwork image cannot accidentally be served for a different track.

## `models.py`

Defines `TrackMetadata`, the in-memory representation of the current track.

The state includes metadata, playback state, connection state, artwork, and track identifiers.

## `metadata_service.py`

Runs the metadata reader in a background thread and keeps the latest state available to the HTTP application.

The browser does not read the FIFO directly. It reads the current snapshot from `MetadataService` through Flask.

## `app.py`

Provides the Flask web application and the HTTP API.

- `/` renders the PlayPanel UI.
- `/now-playing.json` exposes the current state as JSON.
- `/artwork` serves the current artwork after track-ID validation.
- `/favicon.ico` is handled without generating an unnecessary error response.

## `templates/index.html`

Defines the page structure and passes server-side configuration to the browser.

## `static/app.js`

Handles browser-side behavior:

- Polling now-playing metadata
- Track information updates
- Playback state updates
- Artwork fetching and retry logic
- Artwork loading verification
- Record rotation
- Track-change animation
- Clock updates
- Browser screen blanking and wake-up

Artwork is first fetched as a Blob and loaded into an `Image`. The visible artwork is updated only after the browser successfully decodes the image.

## `static/style.css`

Contains the main layout, record design, typography, responsive rules, and animation definitions.

## `config.toml` / `config.py`

Keeps server and UI configuration separate from the application logic so that common visual settings can be changed without editing Python or JavaScript.

---

# Artwork synchronization

Artwork and metadata may not arrive at exactly the same time. PlayPanel therefore treats artwork as track-specific state.

```text
Track A
├── track_id = A
└── artwork_track_id = A

Track B
├── track_id = B
└── artwork_track_id = B
```

If artwork arrives before the persistent track ID, PlayPanel can temporarily keep the artwork unbound and associate it when the track ID arrives. If a new track replaces the old track, stale artwork is cleared instead of being served for the new track.

The browser also retries artwork acquisition when the image is not immediately available.

---

# Troubleshooting

## No track information appears

Check the Shairport Sync metadata FIFO:

```bash
ls -l /tmp/shairport-sync-metadata
```

Then run the metadata reader directly:

```bash
cd ~/PlayPanel
source .venv/bin/activate
python read_metadata.py
```

Start AirPlay playback and confirm that metadata records are being received.

## The page loads but artwork is missing

Check the API state:

```bash
curl -s http://127.0.0.1:8765/now-playing.json | python3 -m json.tool
```

Useful fields are:

```text
has_artwork
track_id
artwork_track_id
playing
connected
```

The track and artwork IDs should match when artwork is ready.

## PlayPanel does not start after reboot

If using systemd:

```bash
systemctl status playpanel.service
journalctl -u playpanel.service -b
```

## Port 8765 is unavailable

Check which process is using it:

```bash
sudo ss -ltnp | grep ':8765'
```

---

# Project structure

```text
PlayPanel/
├── app.py
├── config.py
├── config.toml
├── metadata.py
├── metadata_service.py
├── models.py
├── read_metadata.py
├── test_metadata.py
├── test_metadata.py
├── requirements.txt
├── templates/
│   └── index.html
└── static/
    ├── app.js
    ├── favicon.svg
    └── style.css
```

---

# License

See [LICENSE](LICENSE).