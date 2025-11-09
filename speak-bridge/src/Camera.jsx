import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

const FRAME_SEND_INTERVAL_MS = 100; // min gap between sends
const API_BASE = import.meta.env?.VITE_API_BASE || "http://localhost:8000";

// ---- New motion-gating constants ----
const MOTION_STILL_THRESH = 0.006;   // ~0.6% of frame diagonal
const MOTION_MOVE_THRESH  = 0.012;   // ~1.2% of frame diagonal (hysteresis)
const STABLE_FRAMES_REQUIRED = 3;    // need N consecutive “still” frames
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
];

export default function CameraFeed({ onGesturesChange, canvasClassName, onRecognizedText }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handsRef = useRef(null);
  const requestRef = useRef(null);

  const lastSentRef = useRef(0);
  const isSendingRef = useRef(false);
  const streamAbortRef = useRef(null);

  const [gestures, setGestures] = useState("Starting camera...");

  // ---- Motion tracking state ----
  const prevLandmarksRef = useRef(null);      // [{x,y,z}[] per hand] from prior frame
  const stableRunRef = useRef(0);             // consecutive still frames
  const isCurrentlyStillRef = useRef(false);  // hysteresis state

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
      const blob = await getScaledBlob(canvas, 640, 480, "image/png", 0.9);
      if (!blob) return;

      const fd = new FormData();
      fd.append("frame", blob, "frame.png");

      // update latest.png for debugging (fire-and-forget)
      fetch(`${API_BASE}/api/stream/frame`, { method: "POST", body: fd })
        .catch((err) => console.warn("Failed to send frame:", err));

      onRecognizedText?.(""); // clear textbox

      // cancel any previous SSE stream
      try { streamAbortRef.current?.abort(); } catch {}
      streamAbortRef.current = new AbortController();

      const res = await fetch(`${API_BASE}/api/stream/frame-sse`, {
        method: "POST",
        body: fd,
        signal: streamAbortRef.current.signal,
      });

      if (!res.ok) {
        const body = await res.text();
        onRecognizedText?.((prev) => (prev || "") + `\n[stream http ${res.status}] ${body.slice(0, 400)}`);
        return;
      }

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
              // not JSON; leave token as-is
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

  // ---- Compute normalized motion between frames ----
  function computeMotionMagnitude(landmarksPerHand, width, height) {
    // If no previous landmarks, seed and return high motion to avoid sending immediately
    if (!prevLandmarksRef.current) {
      prevLandmarksRef.current = landmarksPerHand?.map(hand => hand.map(p => ({ x: p.x, y: p.y, z: p.z ?? 0 }))) || null;
      return Infinity;
    }

    const prev = prevLandmarksRef.current;
    // Match by index (MediaPipe keeps consistent ordering for hands within a session reasonably well)
    const handCount = Math.min(prev.length, landmarksPerHand.length);
    if (handCount === 0) {
      prevLandmarksRef.current = null;
      return Infinity;
    }

    const diag = Math.hypot(width, height) || 1; // normalize to frame diagonal
    let accum = 0;
    let points = 0;

    for (let h = 0; h < handCount; h++) {
      const A = prev[h];
      const B = landmarksPerHand[h];
      const n = Math.min(A.length, B.length);
      for (let i = 0; i < n; i++) {
        const dx = (B[i].x - A[i].x) * width;
        const dy = (B[i].y - A[i].y) * height;
        const d = Math.hypot(dx, dy) / diag; // normalized 0..~1
        accum += d;
        points += 1;
      }
    }

    // Update previous for next round (copy by value)
    prevLandmarksRef.current = landmarksPerHand.map(hand => hand.map(p => ({ x: p.x, y: p.y, z: p.z ?? 0 })));

    return points ? (accum / points) : Infinity; // average normalized displacement per landmark
  }

  useEffect(() => {
    handsRef.current = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    handsRef.current.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
    });

    handsRef.current.onResults((results) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const video = videoRef.current;
      if (!video) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.multiHandLandmarks?.length > 0) {
        results.multiHandLandmarks.forEach((lm, idx) => {
          drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: "#00FF88", lineWidth: 4 });
          drawLandmarks(ctx, lm, { color: "#FF3355", lineWidth: 2 });

          if (results.multiHandedness && results.multiHandedness[idx]) {
            const confidence = results.multiHandedness[idx].score;
            const xs = lm.map(p => p.x * canvas.width);
            const ys = lm.map(p => p.y * canvas.height);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            ctx.strokeStyle = "yellow";
            ctx.lineWidth = 2;
            ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

            const barWidth = (maxX - minX) * confidence;
            const barHeight = 6;

            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(minX, minY - barHeight - 2, maxX - minX, barHeight);

            ctx.fillStyle = "yellow";
            ctx.fillRect(minX, minY - barHeight - 2, barWidth, barHeight);

            const visualLeft = canvas.width - maxX;
            const textX = visualLeft + 4;
            const textY = minY - barHeight - 6;
            const text = `${(confidence * 100).toFixed(1)}%`;

            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = "white";
            ctx.font = "12px Arial";
            ctx.fillText(text, textX, textY);
            ctx.restore();
          }
        });

        const msg = `Detected Hands: ${results.multiHandLandmarks.length}`;
        setGestures(msg);
        onGesturesChange?.(msg);

        // ---- Motion gating logic ----
        const motion = computeMotionMagnitude(
          results.multiHandLandmarks,
          canvas.width,
          canvas.height
        );

        // Hysteresis: once still, allow a bit more motion before flipping back to "moving"
        if (isCurrentlyStillRef.current) {
          if (motion > MOTION_MOVE_THRESH) {
            isCurrentlyStillRef.current = false;
            stableRunRef.current = 0;
          } else {
            // still remains still
            stableRunRef.current = Math.min(STABLE_FRAMES_REQUIRED, stableRunRef.current + 1);
          }
        } else {
          if (motion <= MOTION_STILL_THRESH) {
            // candidate still
            stableRunRef.current += 1;
            if (stableRunRef.current >= STABLE_FRAMES_REQUIRED) {
              isCurrentlyStillRef.current = true;
            }
          } else {
            stableRunRef.current = 0;
          }
        }

        // Only send if: (1) currently considered still, (2) we’ve met the interval
        const now = performance.now();
        const canSendByTime = now - lastSentRef.current > FRAME_SEND_INTERVAL_MS;
        if (isCurrentlyStillRef.current && canSendByTime) {
          lastSentRef.current = now;
          sendFrameToBackend(canvas);
        }

      } else {
        // No hands
        prevLandmarksRef.current = null;     // reset motion baseline
        stableRunRef.current = 0;
        isCurrentlyStillRef.current = false;

        const msg = "No hands detected";
        setGestures(msg);
        onGesturesChange?.(msg);
      }

      ctx.restore();
    });

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
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

    return () => {
      try { streamAbortRef.current?.abort(); } catch {}
      cancelAnimationFrame(requestRef.current);
      videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop());
    };
  }, [onGesturesChange, onRecognizedText]);

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline muted style={{ display: "none" }} />
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
