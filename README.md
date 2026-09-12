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
metadata.py          ← メタデータ解析
   ↓
metadata_service.py  ← 最新状態を保持
   ↓
app.py               ← Flask / API / Web UI
   ↓
ブラウザ
```

コードは役割ごとに分けています。

```text
PlayPanel/
├── app.py                 # WebサーバーとAPI
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

次に Web アプリを起動します。

```bash
cd ~/PlayPanel
source .venv/bin/activate
python app.py
```

同じPCならブラウザで以下を開きます。

```text
http://127.0.0.1:8765/
```

API は以下です。

```text
http://127.0.0.1:8765/now-playing.json
```

カバーアートは以下から取得します。

```text
http://127.0.0.1:8765/artwork
```

ブラウザ側は1秒ごとに `/now-playing.json` を確認し、曲情報とカバーアートを更新します。

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
- 基本的な Web UI

## 仮想環境を終了する

```bash
deactivate
```

## 次の段階

1. Web UI のデザイン改善
2. 曲変更時の表示をより滑らかにする
3. 再生時間・プログレス表示
4. 必要なら Shairport Sync の追加 metadata 対応
