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

## NEC でのテスト

依存パッケージをインストール済みなら、まず直接読み取りを確認します。

```bash
cd ~/PlayPanel
python3 read_metadata.py
```

その状態で iPhone から AirPlay 再生します。

次に Web API を起動します。

```bash
cd ~/PlayPanel
python3 app.py
```

別ターミナルから確認します。

```bash
curl http://127.0.0.1:8765/now-playing.json
```

曲名などが JSON で返れば、Shairport Sync → Python → Flask の経路が確認できます。

## 次の段階

1. ブラウザ用 UI
2. カバーアート表示
3. 再生状態・曲変更のリアルタイム更新
4. 必要なら Shairport Sync の追加 metadata 対応
