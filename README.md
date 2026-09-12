# PlayPanel

Shairport Sync の再生メタデータを Python で取得し、Web UI に表示するための小さなアプリです。

## 構成

```text
AirPlay
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
```

## ファイル構成

```text
PlayPanel/
├── app.py                 # WebサーバーとAPI
├── config.py              # 設定ファイルの読み込み
├── config.toml            # ユーザーが編集する設定
├── metadata.py            # Shairport SyncのFIFO解析
├── metadata_service.py    # バックグラウンド読み取りと状態管理
├── models.py              # 曲情報のデータモデル
├── read_metadata.py       # ターミナルでの動作確認用
├── templates/
│   └── index.html         # Web UI
└── static/
    ├── app.js             # ブラウザ側の更新処理
    └── style.css          # Web UIの見た目
```

コードは役割ごとに分けています。

## 必要なもの

- Debian / Ubuntu 系 Linux
- Python 3.11 以上
- Shairport Sync
- Shairport Sync の metadata pipe

PlayPanel 自体は Python の仮想環境 (`venv`) で動かします。

## インストール

GitHub から取得して、仮想環境を作成します。

```bash
git clone https://github.com/sibainugameing/PlayPanel.git
cd PlayPanel

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

```bash
cd ~/PlayPanel
source .venv/bin/activate
python read_metadata.py
```

この状態で iPhone から `VS570 AirPlay` に AirPlay 再生します。

曲名・アーティスト・アルバムなどが表示されれば、

```text
Shairport Sync → metadata pipe → Python
```

の経路が確認できます。

## Web UI の確認

```bash
cd ~/PlayPanel
source .venv/bin/activate
python app.py
```

ブラウザで開きます。

```text
http://127.0.0.1:8765/
```

曲情報のJSON API:

```text
http://127.0.0.1:8765/now-playing.json
```

カバーアート:

```text
http://127.0.0.1:8765/artwork
```

## 設定

画面のカスタマイズは `config.toml` を編集します。

```toml
[layout]
# アルバム画像の大きさ（px）
artwork_size = 460

# 画面全体の最大幅（px）
panel_max_width = 1100

# レコードと曲情報の間隔（px）
panel_gap = 48

[appearance]
# 背景色
background_color = "#111111"

# 文字色
text_color = "#ffffff"

# 再生状態などのアクセント色
accent_color = "#ffffff"

[text]
# タイトルの文字サイズ
title_size = "clamp(2.4rem, 5vw, 5rem)"

# アーティストの文字サイズ
artist_size = "clamp(1.4rem, 2.5vw, 2.2rem)"

# アルバム名の文字サイズ
album_size = "1rem"

[behavior]
# 曲情報を確認する間隔（ミリ秒）
poll_interval_ms = 1000
```

よく変更するのは `artwork_size`、`background_color`、`text_color`、`accent_color` です。

設定を変更したら、PlayPanel を再起動してください。

```text
Ctrl+C
python app.py
```

## 現在の機能

- Shairport Sync の metadata pipe を読み取る
- 曲名 (`core/minm`)
- アーティスト (`core/asar`)
- アルバム (`core/asal`)
- Album Artist (`core/asaa`)
- ジャンル (`core/asgn`)
- 作曲者 (`core/ascp`)
- カバーアート (`ssnc/PICT`)
- AirPlay クライアント名 (`ssnc/snam`)
- 再生状態
- JSON API `/now-playing.json`
- カバーアート API `/artwork`
- TOML 設定ファイルによる画面カスタマイズ

## 次の段階

1. 曲変更時のレコード交換アニメーション
2. レコード回転アニメーション
3. 再生時間・プログレス表示
4. 必要なら Shairport Sync の追加 metadata 対応

## 仮想環境を終了する

```bash
deactivate
```
