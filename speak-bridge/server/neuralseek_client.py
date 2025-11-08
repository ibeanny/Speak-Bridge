import os, json, base64, requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("NEURALSEEK_API_KEY", "")
AGENT_NAME = os.getenv("NEURALSEEK_AGENT_NAME", "ASL_Interpreter")
MAISTRO_STREAM_URL = os.getenv("NEURALSEEK_STREAM_URL", "https://api.neuralseek.com/maistro_stream")

_session = requests.Session()

def stream_frame_png(png_bytes: bytes, prior_hypothesis: str = ""):
    """
    Stream tokens from NeuralSeek for a single PNG/JPEG frame.

    IMPORTANT: matches your mAIstro parameters:
      - frame_png_b64 (prompt: true)
      - prior_hypothesis (prompt: false)
    """
    if not API_KEY:
        yield "[NeuralSeek missing API key]"
        return

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",   # SSE
    }

    # Base64-encode the frame for the 'frame_png_b64' param your agent expects
    b64 = base64.b64encode(png_bytes).decode("ascii")

    payload = {
        "agent": AGENT_NAME,
        "parameters": [
            {"name": "frame_png_b64", "value": b64},
            {"name": "prior_hypothesis", "value": prior_hypothesis or ""},
        ],
        # Your template already sets stream: "true" — sending boolean True is OK too.
        "stream": True,
    }

    try:
        with _session.post(
            MAISTRO_STREAM_URL,
            headers=headers,
            json=payload,
            stream=True,
            timeout=120,
        ) as r:
            # If this raises, surface it to the UI
            r.raise_for_status()

            # Forward each SSE "data: ..." line as a token
            for raw in r.iter_lines(decode_unicode=True):
                if not raw:
                    continue
                line = raw.strip()

                # Some gateways prefix with "data:" for SSE
                if line.startswith("data:"):
                    line = line[5:].strip()

                # If it's JSON, try to pick incremental fields; otherwise echo text
                try:
                    obj = json.loads(line)
                    # Common incremental field names in streaming LLMs:
                    token = obj.get("delta") or obj.get("text") or obj.get("message") or ""
                    if token:
                        yield token
                        continue
                except json.JSONDecodeError:
                    pass

                # Fall back to raw line (e.g., short deltas or the final JSON blob)
                if line:
                    yield line

    except requests.HTTPError as e:
        # Send a single-line error to the UI so you see it immediately
        try:
            err = e.response.text[:500]
        except Exception:
            err = str(e)
        yield f"[NeuralSeek HTTPError] {err}"
    except Exception as e:
        yield f"[NeuralSeek error] {e}"
