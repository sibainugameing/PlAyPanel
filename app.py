from pathlib import Path

from flask import Flask, jsonify


app = Flask(__name__)

METADATA_PIPE = Path("/tmp/shairport-sync-metadata")


@app.get("/")
def index():
    return jsonify(
        {
            "app": "PlayPanel",
            "status": "ok",
            "metadata_pipe": str(METADATA_PIPE),
            "metadata_pipe_exists": METADATA_PIPE.exists(),
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8765, debug=True)
