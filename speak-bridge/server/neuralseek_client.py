import os
import json
import base64
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("NEURALSEEK_API_KEY", "")
AGENT_NAME = os.getenv("NEURALSEEK_AGENT_NAME", "")
AGENT_ID = os.getenv("NEURALSEEK_AGENT_ID", "")
MAISTRO_STREAM_URL = os.getenv(
    "NEURALSEEK_STREAM_URL",
    "https://stagingapi.neuralseek.com/v1/stony7/maistro_stream",
)

def stream_frame_png(png_bytes: bytes, prior_hypothesis: str = ""):
    """
    Streams ASL frames to NeuralSeek using your staging endpoint.
    Expects env vars set in .env.
    """
    if not API_KEY:
        yield "[NeuralSeek config error] Missing NEURALSEEK_API_KEY"
        return

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }

    # ✅ convert to data URL
    b64 = base64.b64encode(png_bytes).decode("ascii")
    data_url = f"data:image/png;base64,{b64}"

    agent_field = {"agent_id": AGENT_ID} if AGENT_ID else {"agent": AGENT_NAME}

    payload = {
        **agent_field,
        "params": [
            {"name": "frame_png_b64", "value": data_url},
            {"name": "prior_hypothesis", "value": prior_hypothesis or ""},
        ],
    }

    try:
        with requests.post(
            MAISTRO_STREAM_URL,
            headers=headers,
            json=payload,
            stream=True,
            timeout=120,
        ) as r:
            if r.status_code != 200:
                yield f"[NeuralSeek HTTPError] {r.status_code} {r.reason} | {r.text[:400]}"
                return

            for raw in r.iter_lines(decode_unicode=True):
                if not raw:
                    continue
                line = raw.strip()
                if line.startswith("data:"):
                    line = line[5:].strip()
                yield line
    except requests.RequestException as e:
        yield f"[NeuralSeek transport error] {e}"