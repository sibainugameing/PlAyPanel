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
shairport.py
   ↓
app.py (Flask)
   ↓
/now-playing.json
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

sudo apt update
sudo apt install -y python3 python3-venv

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## インストール確認

仮想環境を有効にした状態で、以下を実行します。

```bash
cd ~/PlayPanel
source .venv/bin/activate
python --version
python -c "import flask; print('Flask:', flask.__version__)"
```

エラーが出なければ Python / Flask の準備は完了です。

## NEC でのテスト

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

次に Web API を起動します。

```bash
cd ~/PlayPanel
source .venv/bin/activate
python app.py
```

別ターミナルから確認します。

```bash
curl http://127.0.0.1:8765/now-playing.json
```

曲名などが JSON で返れば、

```text
Shairport Sync → Python → Flask → JSON API
```

の経路が確認できます。

## 仮想環境を終了する

```bash
deactivate
```

次回起動するときは、先に仮想環境を有効にします。

```bash
cd ~/PlayPanel
source .venv/bin/activate
```

## 現在の機能

- Shairport Sync の metadata pipe を読み取る
- 曲名 (`core/minm`)
- アーティスト (`core/asar`)
- アルバム (`core/asal`)
- Album Artist (`core/asaa`)
- ジャンル (`core/asgn`)
- 作曲者 (`core/ascp`)
- カバーアートの有無 (`ssnc/PICT`)
- AirPlay クライアント名 (`ssnc/snam`)
- 再生状態
- Flask API `/now-playing.json`

## 次の段階

1. ブラウザ用 UI
2. カバーアート表示
3. 再生状態・曲変更のリアルタイム更新
4. 必要なら Shairport Sync の追加 metadata 対応
