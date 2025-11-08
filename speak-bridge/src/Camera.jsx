import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
];

export default function CameraFeed() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handsRef = useRef(null);
  const requestRef = useRef(null);

  const [gestures, setGestures] = useState("Starting camera...");

  // --- ⬅ NEW: function to send each frame to backend
  const sendFrameToBackend = async (canvas) => {
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const fd = new FormData();
      fd.append("frame", blob, "frame.png"); // ⬅ NEW
      try {
        await fetch("http://localhost:8000/api/stream/frame", { // ⬅ NEW
          method: "POST",                                     // ⬅ NEW
          body: fd,                                           // ⬅ NEW
        });
      } catch (err) {
        console.warn("Failed to send frame:", err);         // ⬅ NEW
      }
    }, "image/png");                                        // ⬅ NEW
  };

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

    handsRef.current.onResults(async (results) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const video = videoRef.current;
      if (!video) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.multiHandLandmarks?.length > 0) {
        results.multiHandLandmarks.forEach((lm) => {
          drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: "#00FF88", lineWidth: 4 });
          drawLandmarks(ctx, lm, { color: "#FF3355", lineWidth: 2 });
        });

        setGestures(`Detected Hands: ${results.multiHandLandmarks.length}`);

        // --- ⬅ NEW: send this frame to backend immediately
        await sendFrameToBackend(canvas); // ⬅ NEW

      } else {
        setGestures("No hands detected");
      }
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
        setGestures("Camera access denied");
      }
    })();

    return () => {
      cancelAnimationFrame(requestRef.current);
      videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function streamToNeuralSeek(canvas, priorHypothesisRef) {
    return new Promise((resolve, reject) => {
      if (!canvas) return resolve("");

      canvas.toBlob(async (blob) => {
        try {
          const fd = new FormData();
          fd.append("frame", blob, "frame.png");
          fd.append("prior_hypothesis", priorHypothesisRef.current || "");

          const res = await fetch("http://localhost:8000/api/asl/stream", {
            method: "POST",
            body: fd,
          });

          if (!res.body) {
            const text = await res.text();
            return resolve(text);
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let full = "";

          const pump = async () => {
            const { value, done } = await reader.read();
            if (done) return resolve(full);
            const chunk = decoder.decode(value, { stream: true });

            // Parse SSE lines (split and strip "data:")
            chunk.split("\n").forEach((line) => {
              if (!line.trim()) return;
              const clean = line.startsWith("data:") ? line.slice(5).trim() : line.trim();
              full += clean;
              // TODO: update your UI token-by-token here if you want
            });

            return pump();
          };

          pump();
        } catch (err) {
          reject(err);
        }
      }, "image/png");
    });
  }

  const priorHypothesisRef = useRef("");

  async function tick() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1) (optional) still send to your local saver:
    // await sendFrameToBackend(canvas);

    // 2) stream from NeuralSeek:
    const streamed = await streamToNeuralSeek(canvas, priorHypothesisRef);

    // keep a short rolling context for the next frame (helps the LLM reason across frames)
    priorHypothesisRef.current = ("Previous hypothesis: " + streamed).slice(-800);

    // update visible text
    setGestures(streamed);
  }


  return (
    <div>
      <h2>Live Camera Feed + Hand Detection (per-frame streaming)</h2>
      <video ref={videoRef} autoPlay playsInline muted style={{ display: "none" }} />
      <canvas
        ref={canvasRef}
        style={{
          width: "640px",
          borderRadius: "12px",
          backgroundColor: "#1e1e1e",
          boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
        }}
      />
      <div style={{ marginTop: 12, fontSize: 18 }}>{gestures}</div>
    </div>
  );
}
// cd speak-bridge cd server uvicorn main:app --reload --port 8000