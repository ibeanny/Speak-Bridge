import os
import time
from pathlib import Path
from io import BytesIO

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from neuralseek_client import stream_frame_png
from eleven_labs_client import generate_speech

from dotenv import load_dotenv #For Eleven Labs API Key

load_dotenv(".env") 

BASE_DIR = Path(__file__).parent.resolve()
STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Speak-Bridge Backend (Public Stream)")

# CORS 
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*")
origins = [o.strip() for o in allowed_origins.split(",")] if allowed_origins else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#  Prevent caching of latest.png
class NoCacheLatest(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        resp = await call_next(request)
        if request.url.path.endswith("/static/latest.png"):
            resp.headers["Cache-Control"] = "no-store, max-age=0"
            resp.headers["Pragma"] = "no-cache"
            resp.headers["Expires"] = "0"
        return resp

app.add_middleware(NoCacheLatest)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

#  Health check 
@app.get("/health")
def health():
    return {"ok": True, "time": int(time.time())}


# Upload ASL frame endpoint
@app.post("/api/stream/frame")
async def upload_frame(frame: UploadFile = File(...)):
    data = await frame.read()
    if not data:
        return PlainTextResponse("empty frame", status_code=400)

    tmp = STATIC_DIR / f"latest_{int(time.time()*1000)}.png"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, STATIC_DIR / "latest.png")

    return {"ok": True, "url": "/static/latest.png", "bytes": len(data)}


@app.post("/api/stream/frame-sse")
async def stream_frame(frame: UploadFile = File(...), prior_hypothesis: str = Form(default="")):
    data = await frame.read()
    if not data:
        return PlainTextResponse("empty frame", status_code=400)

    def gen():
        for token in stream_frame_png(data, prior_hypothesis=prior_hypothesis):
            yield f"data: {token}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")

#Generate speech thorugh Eleven Labs
@app.post("/api/speak")
async def speak(text: str = Form(...)):
    try:
        audio_bytes = generate_speech(text)
        return StreamingResponse(BytesIO(audio_bytes), media_type="audio/mpeg")
    except Exception as e:
        return PlainTextResponse(str(e), status_code=500)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
