import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

const FRAME_SEND_INTERVAL_MS = 200; // send ~1.25 frames per second

// 🔹 ADDED: configurable API base (falls back to localhost)
const API_BASE = import.meta.env?.VITE_API_BASE || "http://localhost:8000";

// Landmark connection pairs that define the hand "skeleton"
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
];

export default function CameraFeed({ onGesturesChange, canvasClassName, onRecognizedText }) { // 🔹 ADDED onRecognizedText in signature
  // Refs for HTML elements and internal state
  const videoRef = useRef(null);     // <video> element (hidden)
  const canvasRef = useRef(null);    // <canvas> for drawing output
  const handsRef = useRef(null);     // MediaPipe Hands instance
  const requestRef = useRef(null);   // requestAnimationFrame ID

  // Refs to control backend communication
  const lastSentRef = useRef(0);      // Last time a frame was sent
  const isSendingRef = useRef(false); // Prevent overlapping fetch calls
  const streamAbortRef = useRef(null); // 🔹 ADDED: to cancel prior SSE stream

  // UI state showing what the system detects
  const [gestures, setGestures] = useState("Starting camera...");

  /**
   * Sends a single frame to the backend.
   * - Converts the canvas to a PNG blob
   * - Sends it via POST to API_BASE
   * - Uses throttle + non-blocking behavior to avoid lag
   * - 🔹 ADDED: Starts SSE stream and appends tokens to onRecognizedText
   */
   const getScaledBlob = (canvas, maxW = 640, maxH = 480, mime = "image/png", quality = 0.9) =>
     new Promise((resolve) => {
       const tmp = document.createElement("canvas");
       const s = Math.min(maxW / canvas.width, maxH / canvas.height, 1);
       tmp.width = Math.round(canvas.width * s);
       tmp.height = Math.round(canvas.height * s);
       tmp.getContext("2d").drawImage(canvas, 0, 0, tmp.width, tmp.height);
       tmp.toBlob((blob) => resolve(blob), mime, quality);
     });

  const sendFrameToBackend = async (canvas) => {
    if (!canvas) return;
    if (isSendingRef.current) return;
    isSendingRef.current = true;

    try {
      // use the **downscaled** blob
      const blob = await getScaledBlob(canvas, 640, 480, "image/png", 0.9);
      if (!blob) return;

      const fd = new FormData();
      fd.append("frame", blob, "frame.png");

      // (keep) update latest.png for debugging
      fetch(`${API_BASE}/api/stream/frame`, { method: "POST", body: fd })
        .catch((err) => console.warn("Failed to send frame:", err));

      // clear textbox at the start of a new stream
      onRecognizedText?.("");

      // abort prior stream to avoid overlap
      try { streamAbortRef.current?.abort(); } catch {}
      streamAbortRef.current = new AbortController();

      const res = await fetch(`${API_BASE}/api/stream/frame-sse`, {
        method: "POST",
        body: fd,
        signal: streamAbortRef.current.signal,
      });

      // if server rejected, show the reason in the textbox and bail
      if (!res.ok) {
        const body = await res.text();
        onRecognizedText?.((prev) => (prev || "") + `\n[stream http ${res.status}] ${body.slice(0, 400)}`);
        return;
      }

      // stream tokens
      const reader = res.body?.getReader?.();
      if (!reader) {
        onRecognizedText?.((p) => (p || "") + "\n[stream error] Reader not available (browser issue)");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (part.startsWith("data: ")) {
            const token = part.slice(6);

            let text = token;
            try {
              // outer could be {"answer":"{...json...}"} or already plain text
              const outer = JSON.parse(token);
              let payload = outer?.answer ?? outer;
              if (typeof payload === "string") {
                try { payload = JSON.parse(payload); } catch {}
              }
              if (payload && typeof payload === "object") {
                const gloss = payload.gloss ?? "UNKNOWN";
                const conf = typeof payload.confidence === "number" ? Math.round(payload.confidence * 100) : null;
                text = conf != null ? `${gloss} (${conf}%)` : gloss;
              } else {
                text = String(payload ?? token);
              }
            } catch {
              // token wasn’t JSON — leave as-is
            }

            onRecognizedText?.((prev) => (prev ? prev + "\n" + text : text));
          }
        }
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("SSE stream error:", err);
        onGesturesChange?.("Stream error");
        onRecognizedText?.((prev) => (prev || "") + `\n[stream error] ${String(err)}`);
      }
    } finally {
      isSendingRef.current = false;
    }
  };

  /**
   * useEffect runs once after mount:
   * - Initializes MediaPipe Hands
   * - Requests camera access
   * - Starts a continuous frame detection loop
   */
  useEffect(() => {
    // Initialize MediaPipe Hands model
    handsRef.current = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    // Model configuration
    handsRef.current.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
    });

    /**
     * MediaPipe callback when a new frame is processed.
     * - Draws the mirrored camera image
     * - Renders detected hands and bounding boxes
     * - Sends frames to backend (throttled)
     */
    handsRef.current.onResults((results) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const video = videoRef.current;
      if (!video) return;

      // Match canvas to video size
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Mirror horizontally (selfie style)
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);

      // Clear old frame + draw current camera image
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      // If any hands detected
      if (results.multiHandLandmarks?.length > 0) {
        results.multiHandLandmarks.forEach((lm, idx) => {
          // Draw lines and points for hand skeleton
          drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: "#00FF88", lineWidth: 4 });
          drawLandmarks(ctx, lm, { color: "#FF3355", lineWidth: 2 });

          // Get confidence of the detected hand
          if (results.multiHandedness && results.multiHandedness[idx]) {
            const confidence = results.multiHandedness[idx].score; // value between 0–1

            // Compute bounding box for the hand
            const xs = lm.map(p => p.x * canvas.width);
            const ys = lm.map(p => p.y * canvas.height);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            const boxWidth = maxX - minX;
            const boxHeight = maxY - minY;

            // Draw yellow box around the hand
            ctx.strokeStyle = "yellow";
            ctx.lineWidth = 2;
            ctx.strokeRect(minX, minY, boxWidth, boxHeight);

            // Confidence bar above the box
            const barWidth = boxWidth * confidence;
            const barHeight = 6;

            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(minX, minY - barHeight - 2, boxWidth, barHeight);

            ctx.fillStyle = "yellow";
            ctx.fillRect(minX, minY - barHeight - 2, barWidth, barHeight);

            // ---- FIX: Draw readable % text (not mirrored) ----
            const visualLeft = canvas.width - maxX; // mirrored X position
            const textX = visualLeft + 4;
            const textY = minY - barHeight - 6;
            const text = `${(confidence * 100).toFixed(1)}%`;

            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0); // reset mirror
            ctx.fillStyle = "white";
            ctx.font = "12px Arial";
            ctx.fillText(text, textX, textY);
            ctx.restore();
          }
        });

        // Update detected hand count in UI
        const msg = `Detected Hands: ${results.multiHandLandmarks.length}`;
        setGestures(msg);
        onGesturesChange?.(msg);

        // Only send a frame to the backend sometimes (throttled)
        // This does NOT affect detection framerate, just network load
        const now = performance.now();
        if (now - lastSentRef.current > FRAME_SEND_INTERVAL_MS) {
          lastSentRef.current = now;
          sendFrameToBackend(canvas);
        }
      } else {
        // No hands found
        const msg = "No hands detected";
        setGestures(msg);
        onGesturesChange?.(msg);
      }

      // Undo mirror transform
      ctx.restore();
    });

    /**
     * Ask for webcam access and start MediaPipe loop.
     * Each frame → sent to `handsRef.current.send()`.
     */
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();

          // Recursive loop for continuous detection
          const loop = async () => {
            await handsRef.current.send({ image: videoRef.current });
            requestRef.current = requestAnimationFrame(loop);
          };
          requestRef.current = requestAnimationFrame(loop);
        };
      } catch (err) {
        console.error("Camera error:", err);
        const msg = "Camera access denied";
        setGestures(msg);
        onGesturesChange?.(msg);
      }
    })();

    // Cleanup when component unmounts
    return () => {
      try { streamAbortRef.current?.abort(); } catch {} // 🔹 ADDED
      cancelAnimationFrame(requestRef.current);
      videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop());
    };
  }, [onGesturesChange, onRecognizedText]); // 🔹 ADDED onRecognizedText dep

  return (
    <div>
      {/* Hidden video: used as MediaPipe input */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ display: "none" }}
      />

      {/* Canvas: visible camera + overlays */}
      <canvas
        ref={canvasRef}
        className={canvasClassName}
        style={{
          width: "640px",
          borderRadius: "12px",
          backgroundColor: "#1e1e1e",
          boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
        }}
      />
    </div>
  );
}
