import React, { useEffect, useRef } from "react";
import { Hands } from "@mediapipe/hands";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
const FRAME_SEND_INTERVAL_MS = 800;

export default function CameraFeed({
  onGesturesChange,         // (text) -> void  e.g., setHandStatus
  onRecognizedText,         // (text) -> void  e.g., setOutputText
  canvasClassName = "",     // extra classes for the <canvas/>
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handPresentRef = useRef(false);
  const lastSentRef = useRef(0);
  const inFlightController = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    async function setup() {
      // Camera
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = stream;
      await video.play();

      // MediaPipe Hands
      const hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });

      hands.onResults((results) => {
        // draw
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        const anyHands = !!(results.multiHandLandmarks && results.multiHandLandmarks.length);
        handPresentRef.current = anyHands;

        if (anyHands) {
          onGesturesChange?.("Hand(s) detected — translating…");
          for (const lm of results.multiHandLandmarks) {
            drawLandmarks(ctx, lm);
            drawConnectors(ctx, lm, [
              [0,1],[1,2],[2,3],[3,4],
              [5,6],[6,7],[7,8],
              [9,10],[10,11],[11,12],
              [13,14],[14,15],[15,16],
              [17,18],[18,19],[19,20],
            ]);
          }
        } else {
          onGesturesChange?.("Waiting for hand signs…");
        }

        ctx.restore();
        sendFrameIfNeeded();
      });

      // main loop
      const tick = async () => {
        await hands.send({ image: video });
        requestAnimationFrame(tick);
      };
      tick();
    }

    setup().catch((e) => {
      onGesturesChange?.("Camera error");
      console.error(e);
    });

    function sendFrameIfNeeded() {
      const now = Date.now();
      if (!handPresentRef.current) return;
      if (now - lastSentRef.current < FRAME_SEND_INTERVAL_MS) return;
      lastSentRef.current = now;

      canvasRef.current.toBlob((blob) => {
        if (!blob) return;

        // cancel previous stream if a new one starts
        if (inFlightController.current) {
          try { inFlightController.current.abort(); } catch {}
        }
        inFlightController.current = new AbortController();

        const fd = new FormData();
        fd.append("frame", blob, "frame.png");

        // (optional) write the latest.png for debugging
        fetch(`${API_BASE}/api/stream/frame`, { method: "POST", body: fd }).catch(() => {});

        // STREAM: clear output then append tokens as they arrive
        onRecognizedText?.(""); // clear the placeholder on each new stream

        fetch(`${API_BASE}/api/stream/frame-sse`, {
          method: "POST",
          body: fd,
          signal: inFlightController.current.signal,
        })
          .then(async (res) => {
            const reader = res.body.getReader();
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
                  onRecognizedText?.((prev) => (typeof prev === "string" ? prev + token : token));
                }
              }
            }
          })
          .catch((err) => {
            if (err?.name !== "AbortError") {
              console.error("stream error", err);
              onGesturesChange?.("Stream error");
            }
          });
      }, "image/png");
    }

    return () => {
      try { inFlightController.current?.abort(); } catch {}
    };
  }, [onGesturesChange, onRecognizedText]);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${canvasClassName}`}
      />
    </div>
  );
}
