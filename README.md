# PlayPanel

**Shairport Sync の音楽情報を、レコード風の画面で表示する Web アプリです。**

AirPlay で再生している曲のタイトル・アーティスト・アルバム・カバーアートなどを取得し、ブラウザ上に大きく見やすく表示します。

## こんな感じで表示できます

<!-- ここにアプリ画面のスクリーンショットを追加 -->

> **画像①：PlayPanel のメイン画面**
>
<img width="2850" height="1892" alt="Image" src="https://github.com/user-attachments/assets/2481690a-2072-483b-8b05-bcb3d4187c2e" />

レコードをイメージしたビジュアルと、大きな曲名・アーティスト表示を組み合わせた UI です。

## 特徴

- AirPlay の再生情報を取得して表示
- 曲名・アーティスト・アルバム・Album Artist・ジャンル・作曲者に対応
- Shairport Sync から取得したカバーアートを表示
- 曲変更時にレコードが入れ替わるアニメーション
- 再生中はレコードが回転
- 長い曲名にも対応
- 時計表示をオン・オフ可能
- 一定時間操作がないと画面を暗転可能
- 同じ LAN 内の別端末からブラウザで表示可能
- `track_id` を使って曲情報とカバーアートを同期
- カバーアート取得失敗時に再試行

<!-- ここに別の画像/GIFを追加 -->

> **画像②：曲変更時のレコード交換アニメーション**
>
> `docs/images/record-transition.gif` を配置して、この部分を画像/GIF表示に置き換える予定です。

## 動作イメージ

```text
iPhone / AirPlay
       ↓
 Shairport Sync
       ↓
 metadata pipe
       ↓
   PlayPanel
       ↓
    Browser
```

PlayPanel は AirPlay の音声そのものを処理するアプリではありません。Shairport Sync が出力したメタデータを読み取り、Web UI に表示します。

---

# 導入方法

## 必要なもの

- Debian / Ubuntu 系 Linux
- Python 3.11 以降推奨
- Shairport Sync
- Shairport Sync の metadata pipe
- Web UI を見る端末

## 1. Shairport Sync の metadata を有効にする

PlayPanel は既定で次の FIFO を読み取ります。

```text
/tmp/shairport-sync-metadata
```

Shairport Sync 側で metadata を有効にし、カバーアートも取得する設定にします。

```text
metadata {
    enabled=yes;
    include_cover_art=yes;
    pipe_name=/tmp/shairport-sync-metadata;
}
```

設定ファイルの場所は環境によって異なります。

## 2. PlayPanel を取得する

```bash
git clone https://github.com/sibainugameing/PlAyPanel.git
cd PlAyPanel
```

すでに取得済みなら更新だけで構いません。

```bash
cd ~/PlayPanel
git pull
```

## 3. Python 環境を作る

```bash
sudo apt update
sudo apt install -y python3 python3-venv

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 4. 設定を確認する

設定は `config.toml` にあります。

初期状態では Web サーバーを `0.0.0.0:8765` で待ち受けます。

```toml
[server]
host = "0.0.0.0"
port = 8765
```

画面サイズ・色・文字サイズ・アニメーション・時計・画面ブランクなども `config.toml` から変更できます。

## 5. メタデータ取得を確認する

```bash
cd ~/PlayPanel
source .venv/bin/activate
python read_metadata.py
```

この状態で iPhone から AirPlay 再生します。

曲名・アーティスト・アルバムなどが表示されれば、Shairport Sync から Python へのメタデータ経路が動作しています。

## 6. PlayPanel を起動する

```bash
source .venv/bin/activate
python app.py
```

NEC 自身から見る場合:

```text
http://127.0.0.1:8765/
```

同じ LAN の別端末から見る場合:

```text
http://<サーバーのIPアドレス>:8765/
```

## 7. AirPlay なしでテストする

README 用のスクリーンショットや UI の動作確認には、付属の `test_metadata.py` を使えます。

このテストは実際の Shairport Sync 用 FIFO とは別の専用 FIFO を使用します。

### ターミナル1: PlayPanelをテストFIFOで起動

```bash
cd ~/PlayPanel
source .venv/bin/activate
PLAYPANEL_METADATA_PIPE=/tmp/playpanel-test-metadata python app.py
```

### ターミナル2: テストデータを送信

```bash
cd ~/PlayPanel
source .venv/bin/activate
python test_metadata.py
```

数秒ごとにテスト用の曲情報とカバーアートが切り替わります。

ブラウザで次を開きます。

```text
http://127.0.0.1:8765/
```

テストを終了するときは両方のターミナルで `Ctrl+C` を押します。

> テスト用 FIFO は `/tmp/playpanel-test-metadata` です。実際の Shairport Sync 用 `/tmp/shairport-sync-metadata` とは分離されています。

---

# 設定

設定ファイルは `config.toml` です。変更後は PlayPanel を再起動してください。

## サーバー

```toml
[server]
host = "0.0.0.0"
port = 8765
```

## レイアウト

```toml
[layout]
artwork_size = 520
panel_max_width = 1180
panel_gap = 70
```

## 見た目

```toml
[appearance]
background_color = "#080808"
text_color = "#f5f5f5"
muted_color = "rgba(245, 245, 245, 0.58)"
```

## 文字サイズ

```toml
[typography]
title_size = "clamp(2.8rem, 5.6vw, 6rem)"
artist_size = "clamp(1.35rem, 2.25vw, 2.15rem)"
album_size = "1rem"
```

## アニメーション

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

## ブラウザ側の動作

```toml
[behavior]
poll_interval_ms = 1000
artwork_retry_interval_ms = 3000
```

## 時計・画面ブランク

```toml
[display]
clock_enabled = true
screen_blank_enabled = true
screen_blank_timeout_minutes = 30
```

`screen_blank_enabled` はブラウザ上に黒いオーバーレイを表示する機能です。ディスプレイ自体の電源を切ったり、DPMS を制御したりする機能ではありません。

---

# 仕組み

ここからは PlayPanel の内部構造について説明します。

## 全体構成

```text
                    AirPlay
                       │
                       ▼
                Shairport Sync
                       │
                       │ metadata
                       ▼
        /tmp/shairport-sync-metadata
                       │
                       ▼
                 metadata.py
                       │
                       ▼
              metadata_service.py
                       │
                       ▼
                    app.py
                  ┌────┴────┐
                  │         │
                  ▼         ▼
        /now-playing.json  /artwork
                  │         │
                  └────┬────┘
                       ▼
                  Web Browser
                       │
                 app.js / CSS
```

設定値は次の流れで UI へ渡されます。

```text
config.toml
     ↓
 config.py
     ↓
   app.py
     ↓
index.html
     ↓
CSS / JavaScript
```

## `metadata.py`

Shairport Sync の metadata FIFO を読み取ります。

メタデータはヘッダーと Base64 データを組み合わせた形式で送られるため、`metadata.py` が解析して Python の値へ変換します。

主に次の metadata を扱います。

| Code | 内容 |
| --- | --- |
| `minm` | 曲名 |
| `asar` | アーティスト |
| `asal` | アルバム |
| `asaa` | Album Artist |
| `asgn` | ジャンル |
| `ascp` | 作曲者 |
| `PICT` | カバーアート |
| `snam` | クライアント名 |
| `mper` | トラック永続ID |
| `pbeg` / `prsm` | 再生開始・再開 |
| `pend` / `aend` / `pfls` / `disc` | 停止・終了系 |

## `models.py`

1曲分の状態を `TrackMetadata` として保持します。

```text
track_id
artwork_track_id
playing
connected
artwork
title
artist
album
...
```

曲情報だけでなく、接続状態とカバーアートの対応関係も同じ状態として扱います。

## `metadata_service.py`

metadata FIFO の継続的な読み取りをバックグラウンドスレッドで行います。

ブラウザから API にアクセスされるたびに FIFO を直接読むのではなく、`MetadataService` が保持している最新状態のコピーを返します。

```text
FIFOを読む処理
      │
      ▼
MetadataService
      │
      ▼
最新状態を保持
      │
      ▼
HTTP APIから取得
```

また、FIFO が開いているかどうかを `connected` として保持します。

## `app.py`

Flask を使って Web UI と API を提供します。

### `/`

PlayPanel の HTML を返します。

### `/now-playing.json`

現在の曲情報、再生状態、接続状態、トラックIDなどを返します。

```json
{
  "title": "曲名",
  "artist": "アーティスト",
  "album": "アルバム",
  "has_artwork": true,
  "playing": true,
  "connected": true,
  "track_id": "track-id",
  "artwork_track_id": "track-id"
}
```

### `/artwork?track_id=<track_id>`

現在のカバーアートを返します。

要求された `track_id` と `artwork_track_id` が一致しない場合は `409` を返します。

これにより、曲が変わった直後に残っている古いカバーを新しい曲へ誤って返すことを防ぎます。

## 曲情報とカバーアートの同期

```text
曲A
├── track_id = A
└── artwork_track_id = A

曲B
├── track_id = B
└── artwork_track_id = B
```

ブラウザが曲Bのカバーを要求すると、サーバー側でIDを照合します。

```text
track_id == artwork_track_id
        ↓
      表示
```

一致しなければ、新しいカバーが届くまで現在の表示を維持し、古いカバーとの組み合わせを防ぎます。

## `templates/index.html`

Web UI の HTML を定義します。

Flask / Jinja2 から設定値を受け取り、CSS カスタムプロパティと JavaScript の設定値へ渡します。

## `static/app.js`

ブラウザ側の処理を担当します。

主な処理:

- `/now-playing.json` の定期取得
- 曲情報の更新
- 接続状態の表示
- 再生状態に応じたレコード回転
- 曲変更時のレコード交換アニメーション
- `/artwork?track_id=...` からカバーアート取得
- カバーアート失敗時の再試行
- 時計更新
- 画面ブランクと復帰

カバーアートはレスポンスを Blob として受け取り、ブラウザ側で画像として読み込めたことを確認してから表示します。

## `static/style.css`

レコード、レイアウト、レスポンシブ表示、アニメーションなどの見た目を担当します。

一部の値は `config.toml` から CSS カスタムプロパティとして渡されます。

## `config.toml` / `config.py`

サーバー設定と UI 設定をコードから分離しています。

```text
config.toml
    ↓
 config.py
    ↓
PlayPanelConfig
    ↓
 app.py
    ├── HTMLへ設定値を渡す
    └── サーバー起動設定に使用
```

これにより、Python コードを直接編集せずに画面サイズ、色、アニメーション速度、時計、画面ブランクなどを変更できます。

## カバーアート取得の再試行

カバーアートが曲情報と同時に届かない場合があります。

PlayPanel は取得に失敗しても現在の表示をすぐに消さず、設定された間隔で再取得します。

```text
曲情報を受信
      ↓
カバー未到着 / 取得失敗
      ↓
現在のカバーを維持
      ↓
再取得
      ↓
画像として正常に読み込めたら更新
```

## テストモード

`test_metadata.py` は実際の AirPlay や Shairport Sync を使わず、Shairport Sync metadata と同じ形式のテストデータを専用 FIFO に送ります。

```text
          test_metadata.py
                 │
                 ▼
 /tmp/playpanel-test-metadata
                 │
                 ▼
          metadata.py
                 │
                 ▼
         PlayPanel Web UI
```

実運用の FIFO と分離しているため、README 用のスクリーンショットや GIF を撮影するときにも使えます。

---

# ファイル構成

```text
PlayPanel/
├── .gitignore
├── LICENSE
├── README.md
├── app.py                 # Flask WebサーバーとAPI
├── config.py              # config.tomlの読み込み
├── config.toml            # PlayPanelの設定
├── metadata.py            # Shairport Sync metadataの解析
├── metadata_service.py    # バックグラウンド読み取りと状態管理
├── models.py              # 曲情報のデータモデル
├── read_metadata.py       # 実環境のmetadata確認用
├── test_metadata.py       # AirPlayなしのテスト用
├── requirements.txt       # Python依存パッケージ
├── templates/
│   └── index.html         # Web UIのHTML
└── static/
    ├── app.js             # ブラウザ側の処理
    ├── favicon.svg        # PlayPanelのアイコン
    └── style.css          # Web UIの見た目
```

---

# ライセンス

MIT License
