# PlayPanel

**Shairport Sync の音楽情報を、レコード風の画面で表示するためのシンプルな Web アプリです。**

AirPlay で再生している曲のタイトル・アーティスト・アルバム・カバーアートなどを取得し、ブラウザ上に大きく見やすく表示します。

## こんな感じで表示できます

<!-- ここにアプリ画面のスクリーンショットを追加 -->

> **画像①：PlayPanel のメイン画面**
> 
> `docs/images/playpanel-main.png` を配置して、この部分を画像表示に置き換える予定です。

レコードをイメージしたビジュアルと、大きな曲名・アーティスト表示を組み合わせた UI です。

## 特徴

- AirPlay の再生情報をリアルタイムに取得
- 曲名・アーティスト・アルバム・Album Artist・ジャンル・作曲者を表示
- Shairport Sync から取得したカバーアートを表示
- 曲変更時にレコードが入れ替わるアニメーション
- 再生中はレコードが回転
- 長い曲名にも対応
- 現在時刻を画面上部に表示可能
- 一定時間操作がないと画面を暗転可能
- 同じ LAN 内のスマートフォン・PCなどからブラウザで表示可能
- カバーアートと曲情報を `track_id` で同期し、古いカバーが新しい曲に表示されるのを防止

<!-- ここに別の画像を追加 -->

> **画像②：曲が変わるときのレコード交換アニメーション**
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

PlayPanel は、AirPlay の音声そのものを処理するアプリではありません。Shairport Sync が取得・出力したメタデータを読み取り、それを Web UI に表示します。

---

# 導入方法

## 必要なもの

- Debian / Ubuntu 系 Linux
- Python 3.11 以降推奨
- Shairport Sync
- Shairport Sync の metadata pipe
- Web UI を見る端末（同一 LAN 内で使用する場合）

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

環境によって Shairport Sync の設定ファイルの場所は異なります。

## 2. PlayPanel を取得する

```bash
git clone https://github.com/sibainugameing/PlAyPanel.git
cd PlAyPanel
```

すでに取得済みの場合は、更新だけで構いません。

```bash
cd ~/PlayPanel
git pull
```

## 3. Python の仮想環境を作る

```bash
sudo apt update
sudo apt install -y python3 python3-venv

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 4. 設定を確認する

設定は `config.toml` にまとめています。

初期状態では次の設定です。

```toml
[server]
host = "0.0.0.0"
port = 8765
```

必要に応じて画面サイズや色、アニメーションなども変更できます。詳しくは下の「設定」章を参照してください。

## 5. メタデータ取得を確認する

まず、Web UI を起動する前に metadata pipe が読めることを確認します。

```bash
source .venv/bin/activate
python read_metadata.py
```

この状態で iPhone から AirPlay 再生します。

曲名・アーティスト・アルバムなどが表示されれば、

```text
Shairport Sync → metadata pipe → Python
```

の部分は正常です。

## 6. PlayPanel を起動する

```bash
source .venv/bin/activate
python app.py
```

既定では `0.0.0.0:8765` で待ち受けます。

NEC自身から見る場合:

```text
http://127.0.0.1:8765/
```

同じ LAN の別端末から見る場合:

```text
http://<サーバーのIPアドレス>:8765/
```

例:

```text
http://192.168.11.18:8765/
```

---

# 設定

設定ファイルは `config.toml` です。

変更した設定を反映するには PlayPanel を再起動してください。

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

## `metadata.py`

Shairport Sync の metadata pipe を直接読み取ります。

metadata はテキストのヘッダーと Base64 データを組み合わせた形式で送られてくるため、`metadata.py` がこれを解析して Python の値に変換します。

主に次の metadata を扱います。

- `minm` : 曲名
- `asar` : アーティスト
- `asal` : アルバム
- `asaa` : Album Artist
- `asgn` : ジャンル
- `ascp` : 作曲者
- `PICT` : カバーアート
- `snam` : クライアント名
- `mper` : トラック永続ID
- 再生・停止状態に関する metadata

## `models.py`

1曲分の状態を `TrackMetadata` として保持します。

曲情報だけでなく、次の状態も持ちます。

- `track_id`
- `artwork_track_id`
- `playing`
- `connected`
- `artwork`

これにより、単なる「曲名の文字列」ではなく、現在の再生状態をひとまとまりのデータとして扱えます。

## `metadata_service.py`

metadata pipe の読み取りは Web サーバーのリクエスト処理とは別のバックグラウンドスレッドで行います。

ブラウザから API にアクセスされたときは、毎回 FIFO を直接読むのではなく、`MetadataService` が保持している最新状態のスナップショットを返します。

これにより、次の2つを分離しています。

```text
metadata pipe の継続的な読み取り
                ≠
ブラウザからの HTTP リクエスト
```

## `app.py`

Flask で Web サーバーを動かします。

主なエンドポイントは次の3つです。

### `/`

PlayPanel の Web UI を返します。

### `/now-playing.json`

現在の曲情報や接続状態を JSON で返します。

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

ここでは、リクエストされた `track_id` と `artwork_track_id` を比較します。

一致しない場合は `409` を返し、ブラウザが古いカバーアートを新しい曲に表示することを防ぎます。

## 曲情報とカバーアートの同期

PlayPanel では、曲変更時の表示ずれを防ぐためにトラックIDを使います。

```text
曲A
├── track_id = A
└── artwork_track_id = A

曲B
├── track_id = B
└── artwork_track_id = B
```

ブラウザが曲Bのカバーを要求したとき、サーバー側で「現在のカバーもB用か」を確認します。

そのため、曲が変わった直後に古いカバーアートが残っていても、誤って新しい曲のカバーとして返すことを避けられます。

## `templates/index.html`

Web UI の HTML を定義します。

Jinja2 のテンプレートとして Flask から設定値を受け取り、CSS 変数や JavaScript の設定値に渡します。

## `static/app.js`

ブラウザ側の処理を担当します。

主に次の処理を行います。

- `/now-playing.json` を定期的に取得
- 曲情報を画面に反映
- 再生状態に応じてレコードを回転
- 曲変更時のレコード交換アニメーション
- `/artwork?track_id=...` からカバーアート取得
- カバーアートの読み込み失敗時に再試行
- 時計の更新
- 画面ブランクと復帰

カバーアートは取得したレスポンスを Blob に変換し、ブラウザ側で一度画像として読み込んでから表示します。読み込みに失敗した場合は現在表示中のカバーを維持します。

## `static/style.css`

レコード、レイアウト、レスポンシブ表示、アニメーションなど、Web UI の見た目を担当します。

アニメーションの一部は `config.toml` の値から CSS カスタムプロパティとして渡されます。

## `config.py` → `config.toml`

設定はコードに直接書き込まず、`config.toml` に分離しています。

```text
config.toml
      ↓
   config.py
      ↓
     app.py
      ↓
index.html / app.js / style.css
```

そのため、サーバーのポートや画面サイズ、色、アニメーション速度などを Python コードを直接編集せずに変更できます。

## エラー時のカバーアート処理

カバーアートは metadata と同時に到着するとは限りません。

そのため、PlayPanel は次のように動作します。

```text
曲情報を受信
      ↓
カバー未到着
      ↓
現在のカバーを維持
      ↓
カバー取得を再試行
      ↓
成功したら表示を更新
```

さらに、曲IDが一致しない場合はサーバー側でも拒否するため、ブラウザ側だけに同期処理を任せない構成になっています。

---

# API ステータス

`/artwork` の主なレスポンス:

| HTTP | 意味 |
|---:|---|
| `200` | カバーアートを返却 |
| `400` | `track_id` が指定されていない |
| `404` | カバーアートがまだ取得できていない |
| `409` | 曲IDとカバーアートのIDが一致しない |
| `415` | 対応していない画像形式 |

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
├── metadata.py            # Shairport Sync metadata pipeの解析
├── metadata_service.py    # バックグラウンド読み取りと状態管理
├── models.py              # 曲情報のデータモデル
├── read_metadata.py       # ターミナルでの動作確認用
├── requirements.txt       # Python依存パッケージ
├── templates/
│   └── index.html         # Web UIのHTML
└── static/
    ├── app.js             # ブラウザ側の処理
    ├── favicon.svg        # favicon
    └── style.css          # Web UIの見た目
```

## 仮想環境を終了する

```bash
deactivate
```
