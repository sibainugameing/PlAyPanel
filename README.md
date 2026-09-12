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
   ↓
ブラウザ
```

## ファイル構成

```text
PlayPanel/
├── app.py                 # Flask WebサーバーとAPI
├── metadata.py            # Shairport SyncのFIFO解析
├── metadata_service.py    # バックグラウンド読み取りと状態管理
├── models.py              # 曲情報のデータモデル
├── read_metadata.py       # ターミナルでの動作確認用
├── templates/
│   └── index.html         # Web UIのHTML
└── static/
    ├── app.js             # ブラウザ側の更新処理
    ├── favicon.svg        # PlayPanelのアイコン
    └── style.css          # Web UIの見た目
```

各ファイルは役割ごとに分けています。

## 必要なもの

- Debian / Ubuntu 系 Linux
- Python 3
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

まず Shairport Sync の metadata pipe を直接読み取ります。

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

曲情報のJSON API:

```text
http://<NECのIPアドレス>:8765/now-playing.json
```

カバーアート:

```text
http://<NECのIPアドレス>:8765/artwork
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
- レコード風 Web UI
- LAN内の別端末からのWebアクセス

## UIについて

画面のレイアウトや見た目は `templates/index.html` と `static/style.css` にまとめています。
現在は設定ファイルを使わず、コードをシンプルにしています。

## 次の段階

1. 曲変更時のレコード交換アニメーション
2. レコード回転アニメーション
3. 再生時間・プログレス表示
4. 必要なら Shairport Sync の追加 metadata 対応

## 仮想環境を終了する

```bash
deactivate
```
