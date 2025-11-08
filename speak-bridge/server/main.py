# server/main.py
import os, time
from pathlib import Path
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, HTMLResponse, PlainTextResponse
from fastapi.responses import StreamingResponse
from fastapi import Form
from neuralseek_client import stream_frame_png


# --- create app FIRST ---
app = FastAPI(title="Speak-Bridge Backend")

# CORS (dev-friendly)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# static dir mount
BASE_DIR = Path(__file__).parent.resolve()
STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# helpers
def _detect_container(data: bytes) -> str:
    """
    Return 'webm' or 'mp4' by magic bytes.
    WebM/Matroska: starts with 0x1A45DFA3 (EBML)
    MP4/ISO BMFF: usually contains 'ftyp' at bytes 4..12
    """
    if not data or len(data) < 12:
        return "unknown"
    if data[:4] == b"\x1A\x45\xDF\xA3":
        return "webm"
    if b"ftyp" in data[4:12]:
        return "mp4"
    return "unknown"

# routes
@app.get("/", response_class=HTMLResponse)
def root():
    return '<h1>Speak-Bridge API</h1><p>Latest: <a href="/api/stream/latest">/api/stream/latest</a></p>'

@app.get("/favicon.ico", response_class=PlainTextResponse)
def favicon():
    return ""

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/api/stream/segment")
async def stream_segment(video: UploadFile = File(...)):
    """
    Accept a short video chunk, detect container, and atomically replace
    /static/current.webm or /static/current.mp4 accordingly.
    """
    data = await video.read()
    size = len(data or b"")
    if size == 0:
        return {"ok": False, "skipped": True, "reason": "empty"}

    kind = _detect_container(data)
    ctype = (video.content_type or "").lower()
    if kind == "unknown":
        if ctype.startswith("video/webm"):
            kind = "webm"
        elif ctype.startswith("video/mp4"):
            kind = "mp4"

    suffix = ".webm" if kind == "webm" else ".mp4"
    tmp = STATIC_DIR / f"current_{int(time.time()*1000)}{suffix}"
    with open(tmp, "wb") as f:
        f.write(data)
    final = STATIC_DIR / f"current{suffix}"
    os.replace(tmp, final)

    # remove the opposite-format file so you don't chase a stale one
    other = STATIC_DIR / ("current.mp4" if suffix == ".webm" else "current.webm")
    if other.exists():
        try:
            other.unlink()
        except:
            pass

    return {"ok": True, "url": f"/static/current{suffix}", "bytes": size, "detected": kind, "ctype": ctype}

@app.get("/api/stream/latest")
def latest():
    webm = STATIC_DIR / "current.webm"
    mp4  = STATIC_DIR / "current.mp4"
    if webm.exists():
        return {"url": "/static/current.webm", "ctype": "video/webm"}
    if mp4.exists():
        return {"url": "/static/current.mp4", "ctype": "video/mp4"}
    return JSONResponse({"error": "no file yet"}, status_code=404)

@app.post("/api/stream/frame")
async def stream_frame(frame: UploadFile = File(...)):
    """
    Accept a single PNG/JPEG frame and atomically replace /static/latest.png (or .jpg).
    Also writes a timestamped copy for debugging.
    """
    data = await frame.read()
    if not data:
        return JSONResponse({"ok": False, "reason": "empty"}, status_code=400)

    # decide extension by content type; default to .png
    ctype = (frame.content_type or "").lower()
    ext = ".png"
    if "jpeg" in ctype or "jpg" in ctype:
        ext = ".jpg"

    # timestamped copy (optional)
    ts = int(time.time() * 1000)
    tmp = STATIC_DIR / f"latest_{ts}{ext}"
    with open(tmp, "wb") as f:
        f.write(data)

    # atomically set latest.{ext}
    final = STATIC_DIR / f"latest{ext}"
    os.replace(tmp, final)

    # remove the other extension's latest file to avoid confusion
    other = STATIC_DIR / ("latest.jpg" if ext == ".png" else "latest.png")
    if other.exists():
        try:
            other.unlink()
        except:
            pass

    return {"ok": True, "url": f"/static/latest{ext}", "bytes": len(data), "ctype": ctype}

    @app.post("/api/asl/stream")
    async def asl_stream(
        frame: UploadFile = File(...),
        prior_hypothesis: str = Form("")  # optional rolling context
    ):
        """
        Accept a single PNG/JPEG frame and stream NeuralSeek tokens back to the client.
        """
        data = await frame.read()
        if not data:
            return PlainTextResponse("empty frame", status_code=400)

        # Forward to NeuralSeek /maistro_stream and stream tokens back
        def generator():
            for token in stream_frame_png(data, prior_hypothesis=prior_hypothesis):
                # Send as Server-Sent Events (simple/compatible)
                yield f"data: {token}\n\n"

        return StreamingResponse(generator(), media_type="text/event-stream")
