from __future__ import annotations

from io import BytesIO

from flask import Flask, jsonify, render_template, send_file

from metadata import DEFAULT_PIPE, detect_image_type
from metadata_service import MetadataService


HOST = "0.0.0.0"
PORT = 8765


app = Flask(__name__)
metadata_service = MetadataService(DEFAULT_PIPE)


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/now-playing.json")
def now_playing():
    state = metadata_service.snapshot()
    return jsonify(state.as_dict())


@app.get("/artwork")
def artwork():
    state = metadata_service.snapshot()
    if state.artwork is None:
        return ("", 404)

    image_type = detect_image_type(state.artwork)
    if image_type is None:
        return ("", 415)

    return send_file(
        BytesIO(state.artwork),
        mimetype=image_type,
        max_age=0,
    )


@app.get("/favicon.ico")
def favicon():
    return ("", 204)


if __name__ == "__main__":
    metadata_service.start()
    app.run(
        host=HOST,
        port=PORT,
        debug=True,
        use_reloader=False,
    )
