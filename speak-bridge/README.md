# Speak-Bridge

Real-time **ASL → speech** demo with a React (Vite) frontend and a FastAPI backend that streams frames to a NeuralSeek agent and can synthesize spoken audio with ElevenLabs.

---

## What’s inside

- **Frontend:** React 19 + Vite, Tailwind v4 (`@tailwindcss/vite`), MediaPipe Hands for landmark detection.  
- **Backend:** FastAPI with CORS, static file hosting, **SSE streaming** to NeuralSeek, and a `/api/speak` endpoint using **ElevenLabs** TTS.  
- **Debugging:** latest captured frame saved at `server/static/latest.png` for quick visual checks.

---

## Project layout (key files)

Speak-Bridge/
├── package.json
└── speak-bridge/
├── index.html
├── vite.config.js
├── package.json
├── src/
│ ├── main.jsx
│ ├── App.jsx
│ └── Camera.jsx
└── server/
├── main.py
├── neuralseek_client.py
├── eleven_labs_client.py
└── static/

---

## Architecture

Camera (browser) → MediaPipe Hands → PNG frame → FastAPI
│
├─ POST /api/stream/frame (updates /static/latest.png)
└─ POST /api/stream/frame-sse (SSE → NeuralSeek)
│
└─ Client UI parses tokens → recognized gloss
Text → POST /api/speak → ElevenLabs → MP3 stream → audio playback

---

 Environment variables

Create 'speak-bridge/server/.env`:

``ini
# CORS
ALLOWED_ORIGINS=http://localhost:5173

# NeuralSeek
NEURALSEEK_API_KEY=your_ns_api_key
NEURALSEEK_AGENT_ID=your_agent_id
# or
# NEURALSEEK_AGENT_NAME=YourAgentName
# Optional custom stream URL:
# NEURALSEEK_STREAM_URL=https://stagingapi.neuralseek.com/v1/<tenant>/maistro_stream

# ElevenLabs
ELEVENLABS_API_KEY=your_elevenlabs_key 

Create optional speak-bridge/.env for the frontend:
VITE_API_BASE=http://localhost:8000
Running locally

Backend (FastAPI)
cd speak-bridge/server
python3 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install fastapi uvicorn[standard] python-dotenv requests elevenlabs
python main.py
# → runs on http://localhost:8000
Endpoints
Method	Route	Purpose
GET	/health	health check
POST	/api/stream/frame	uploads a frame and updates /static/latest.png
POST	/api/stream/frame-sse	streams frame to NeuralSeek (SSE)
POST	/api/speak	converts text → speech using ElevenLabs

Frontend (Vite + React)
cd speak-bridge
npm install
npm run dev
# → http://localhost:5173

🔌 How the NeuralSeek stream works
neuralseek_client.py posts your PNG (base64) to maistro_stream:
{
  "agent_id": "…",
  "params": [
    { "name": "frame_png_b64", "value": "data:image/png;base64,..." },
    { "name": "prior_hypothesis", "value": "" }
  ]
}
Headers:
Authorization: Bearer <NEURALSEEK_API_KEY>
Accept: text/event-stream
The backend yields data: lines; frontend parses JSON like:

{ "gloss": "HELLO", "confidence": 0.82 }

ElevenLabs TTS
/api/speak uses your ElevenLabs key:
voice → Rachel
model → eleven_multilingual_v2
output → MP3 (44.1 kHz, 128 kbps)
Frontend posts text, receives audio stream, and plays it instantly.

Key files explained
File	Description
src/Camera.jsx	Captures webcam, runs MediaPipe Hands, and posts frames to backend
src/App.jsx	UI shell: video, recognized text, speech button, dark/light mode
src/main.jsx	React entry
vite.config.js	Vite + Tailwind integration
server/main.py	FastAPI app (CORS, static, SSE, TTS)
server/neuralseek_client.py	NeuralSeek streaming logic
server/eleven_labs_client.py	ElevenLabs speech generation

Expose locally (ngrok)
ngrok http 8000
# copy the https URL and set:
VITE_API_BASE=https://<random>.ngrok-free.app
npm run dev

Troubleshooting
401 Unauthorized (NeuralSeek): check NEURALSEEK_API_KEY and agent ID/name.
500 / timeout: avoid flooding the stream—motion gating is built-in.
CORS errors: ensure your frontend origin is listed in ALLOWED_ORIGINS.
latest.png not updating: confirm /api/stream/frame is called at least once.
MediaPipe assets showing in XHR: safe—these stay local; only PNGs go to NeuralSeek.

License
MIT (adjust if desired).

Credits
MediaPipe Hands © Google
Vite & React
NeuralSeek (mAIstro Stream)
ElevenLabs TTS
