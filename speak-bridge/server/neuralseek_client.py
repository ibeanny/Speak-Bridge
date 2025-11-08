# speak-bridge/server/neuralseek_client.py
import os, json, base64, requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("NEURALSEEK_API_KEY", "")
AGENT_NAME = os.getenv("NEURALSEEK_AGENT_NAME", "ASL_Interpreter")
MAISTRO_STREAM_URL = os.getenv("NEURALSEEK_STREAM_URL", "https://api.neuralseek.com/maistro_stream")

_session = requests.Session()
_headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "Accept": "text/event-stream",  # SSE style
}

def stream_frame_png(frame_bytes: bytes, prior_hypothesis: str = ""):
    """
    Yields text chunks (tokens) from NeuralSeek's /maistro_stream
    given a single PNG (bytes). Keeps payload minimal & safe.
    """
    b64 = base64.b64encode(frame_bytes).decode("utf-8")
    payload = {
        "agent_name": AGENT_NAME,
        "inputs": {
            "frame_png_b64": b64,
            "prior_hypothesis": prior_hypothesis
        }
    }

    with _session.post(MAISTRO_STREAM_URL, headers=_headers, data=json.dumps(payload), stream=True, timeout=60) as r:
        r.raise_for_status()
        for raw_line in r.iter_lines(decode_unicode=True):
            if not raw_line:
                continue
            line = raw_line.strip()
            # Handle "data: ..." SSE or plain lines
            if line.startswith("data:"):
                line = line[5:].strip()
            # Try JSON first, then fall back to raw text
            try:
                obj = json.loads(line)
                chunk = obj.get("delta") or obj.get("text") or ""
            except json.JSONDecodeError:
                chunk = line
            if chunk:
                yield chunk
