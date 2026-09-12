# PlayPanel

Shairport Sync の再生メタデータを Python で取得し、レコード風の Web UI に表示するためのアプリです。

AirPlay → Shairport Sync → metadata pipe → Python → Web UI という構成で動作します。

## 構成

```text
AirPlay (iPhoneなど)
        ↓
  Shairport Sync
        ↓
/tmp/shairport-sync-metadata
        ↓
   metadata.py
        ↓
metadata_service.py
        ↓
      app.py
        ↓
index.html + app.js + style.css
        ↓
     ブラウザ
```

設定値は `config.toml` から読み込みます。

```text
config.toml
    ↓
  config.py
    ↓
   app.py
    ↓
HTML / CSS / JavaScript
```

## ファイル構成

```text
PlayPanel/
├── .gitignore
├── LICENSE
├── README.md
├── app.py                 # Flask WebサーバーとAPI
├── config.py              # config.tomlの読み込み
├── config.toml            # PlayPanelの設定ファイル
├── metadata.py            # Shairport Sync metadata pipeの解析
├── metadata_service.py    # バックグラウンド読み取りと最新状態の管理
├── models.py              # 曲情報のデータモデル
├── read_metadata.py       # ターミナルでのメタデータ動作確認用
├── requirements.txt       # Python依存パッケージ
├── templates/
│   └── index.html         # Web UIのHTML
└── static/
    ├── app.js             # ブラウザ側の更新・アニメーション処理
    ├── favicon.svg        # PlayPanelのアイコン
    └── style.css          # Web UIの見た目とアニメーション
```

各ファイルは役割ごとに分離しています。

## 必要なもの

- Debian / Ubuntu 系 Linux
- Python 3.11 以降推奨
- Shairport Sync
- Shairport Sync の metadata pipe
- 同じLANからWeb UIを見る場合は、NECなどのサーバーとクライアント端末が同一LAN上にあること

PlayPanel 自体は Python の仮想環境 (`venv`) で動かします。

## Shairport Sync の設定

PlayPanel は既定で次の metadata pipe を読み取ります。

```text
/tmp/shairport-sync-metadata
```

Shairport Sync 側では metadata を有効にし、必要に応じてカバーアートを含めます。

```text
metadata {
    enabled=yes;
    include_cover_art=yes;
    pipe_name=/tmp/shairport-sync-metadata;
}
```

## インストール

GitHub から取得して、仮想環境を作成します。

```bash
git clone https://github.com/sibainugameing/PlAyPanel.git
cd PlAyPanel

sudo apt update
sudo apt install -y python3 python3-venv

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

すでに `PlayPanel` を取得済みの場合は、`git clone` は不要です。

```bash
cd ~/PlayPanel
git pull
source .venv/bin/activate
pip install -r requirements.txt
```

## メタデータ取得の確認

まず Shairport Sync の metadata pipe を直接読み取ります。

```bash
cd ~/PlayPanel
source .venv/bin/activate
python read_metadata.py
```

この状態で iPhone から AirPlay 再生します。

曲名・アーティスト・アルバムなどが表示されれば、

```text
Shairport Sync → metadata pipe → Python
```

の経路が確認できます。

## Web UI の起動

```bash
cd ~/PlayPanel
source .venv/bin/activate
python app.py
```

既定の待受先は `0.0.0.0:8765` です。

NEC自身で見る場合:

```text
http://127.0.0.1:8765/
```

同じLANの別端末から見る場合:

```text
http://<NECのIPアドレス>:8765/
```

例:

```text
http://192.168.11.18:8765/
```

## API

### 再生情報

```text
GET /now-playing.json
```

現在の曲情報、再生状態、Shairport Sync の接続状態、曲ID、カバーアートの同期状態などを返します。

レスポンス例:

```json
{
  "title": "曲名",
  "artist": "アーティスト",
  "album": "アルバム",
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

### カバーアート

```text
GET /artwork?track_id=<track_id>
```

カバーアートは曲IDと紐付けて管理しています。
要求した `track_id` と現在のカバーアートの `artwork_track_id` が一致しない場合は、古いカバーが新しい曲に表示されるのを防ぐため `409` を返します。

主なステータス:

- `400`: `track_id` が指定されていない
- `404`: カバーアートがまだ取得できていない
- `409`: 曲IDとカバーアートのIDが一致しない
- `415`: 対応していない画像形式
- `200`: カバーアートを返却

## 現在の機能

- Shairport Sync metadata pipe の読み取り
- 曲名 (`minm`)
- アーティスト (`asar`)
- アルバム (`asal`)
- Album Artist (`asaa`)
- ジャンル (`asgn`)
- 作曲者 (`ascp`)
- カバーアート (`PICT`)
- AirPlay クライアント名 (`snam`)
- 再生状態の取得
- Shairport Sync metadata pipe の接続状態の取得
- トラック永続ID (`mper`) の取得
- 曲情報とカバーアートのトラックID同期
- JSON API `/now-playing.json`
- カバーアート API `/artwork`
- レコード風 Web UI
- 曲変更時のレコード交換アニメーション
- 再生中のレコード回転アニメーション
- 曲変更時の曲情報アニメーション
- 長い曲名を考慮したタイトル表示
- 小型時計表示
- 一定時間操作がない場合の画面ブランク
- LAN内の別端末からのWebアクセス
- カバーアート取得失敗時の再試行

## 設定

設定は `config.toml` で変更できます。

変更後は PlayPanel を再起動してください。

### サーバー

```toml
[server]
host = "0.0.0.0"
port = 8765
```

### レイアウト

```toml
[layout]
artwork_size = 520
panel_max_width = 1180
panel_gap = 70
```

### 見た目

```toml
[appearance]
background_color = "#080808"
text_color = "#f5f5f5"
muted_color = "rgba(245, 245, 245, 0.58)"
```

### 文字サイズ

```toml
[typography]
title_size = "clamp(2.8rem, 5.6vw, 6rem)"
artist_size = "clamp(1.35rem, 2.25vw, 2.15rem)"
album_size = "1rem"
```

### アニメーション

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

### ブラウザ側の動作

```toml
[behavior]
poll_interval_ms = 1000
artwork_retry_interval_ms = 3000
```

### 時計と画面ブランク

```toml
[display]
clock_enabled = true
screen_blank_enabled = true
screen_blank_timeout_minutes = 30
```

`screen_blank_enabled` はブラウザ画面を黒くする機能です。ハードウェアの電源管理やDPMSによってディスプレイ自体を物理的にオフにする機能ではありません。

## 動作確認

### 1. メタデータが取得できるか確認

```bash
source .venv/bin/activate
python read_metadata.py
```

### 2. Webサーバーを起動

```bash
source .venv/bin/activate
python app.py
```

### 3. JSON APIを確認

別ターミナルで:

```bash
curl -s http://127.0.0.1:8765/now-playing.json
```

`connected`, `track_id`, `artwork_track_id` などが確認できます。

### 4. 曲変更とカバーアートの同期を確認

曲Aを再生したあと曲Bへ変更し、次を確認します。

```text
曲Aの情報 + 曲Aのカバー
        ↓
曲Aのカバーが退出
        ↓
曲Bの情報 + 曲Bのカバーが表示
```

古いカバーと新しい曲情報が組み合わさることを防ぐため、カバーアートは `track_id` と照合して表示します。

## 仮想環境を終了する

```bash
deactivate
```

## 開発方針

PlayPanel は、まず Shairport Sync の metadata を安定して取得することを優先し、その上に Web UI を構築しています。

機能追加時も、メタデータ取得部分・状態管理・Web API・ブラウザUIを分離した構成を維持します。
