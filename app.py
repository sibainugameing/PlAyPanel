from __future__ import annotations

from io import BytesIO

from flask import Flask, jsonify, render_template, request, send_file

from config import load_config
from metadata import DEFAULT_PIPE, detect_image_type
from metadata_service import MetadataService


config = load_config()
app = Flask(__name__)
metadata_service = MetadataService(DEFAULT_PIPE)


@app.context_processor
def template_settings():
    return {"config": config}


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
    requested_track_id = request.args.get("track_id", "")

    if not requested_track_id:
        return jsonify({"error": "track_id is required"}), 400

    if state.artwork is None:
        return jsonify({"error": "artwork_not_ready"}), 404

    if state.artwork_track_id != requested_track_id:
        return (
            jsonify(
                {
                    "error": "artwork_track_mismatch",
                    "current_track_id": state.track_id,
                    "artwork_track_id": state.artwork_track_id,
                }
            ),
            409,
        )

    image_type = detect_image_type(state.artwork)
    if image_type is None:
        return jsonify({"error": "unsupported_artwork_format"}), 415

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
        host=config.host,
        port=config.port,
        debug=True,
        use_reloader=False,
    )
