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

export default function CameraFeed({ onGesturesChange, canvasClassName }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const handsRef = useRef(null);
    const requestRef = useRef(null);

    const [gestures, setGestures] = useState("Starting camera...");

    // --- send each frame to backend
    const sendFrameToBackend = async (canvas) => {
        if (!canvas) return;

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const fd = new FormData();
            fd.append("frame", blob, "frame.png");
            try {
                await fetch("http://localhost:8000/api/stream/frame", {
                    method: "POST",
                    body: fd,
                });
            } catch (err) {
                console.warn("Failed to send frame:", err);
            }
        }, "image/png");
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

            // --- Mirror the canvas horizontally (selfie-style)
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
                        const confidence = results.multiHandedness[idx].score; // 0 to 1

                        // --- bounding box around hand
                        const xs = lm.map(p => p.x * canvas.width);
                        const ys = lm.map(p => p.y * canvas.height);
                        const minX = Math.min(...xs);
                        const maxX = Math.max(...xs);
                        const minY = Math.min(...ys);
                        const maxY = Math.max(...ys);

                        const boxWidth = maxX - minX;
                        const boxHeight = maxY - minY;

                        // --- draw box
                        ctx.strokeStyle = "yellow";
                        ctx.lineWidth = 2;
                        ctx.strokeRect(minX, minY, boxWidth, boxHeight);

                        // --- draw confidence bar at top of box
                        const barWidth = boxWidth * confidence;
                        const barHeight = 6;

                        // background
                        ctx.fillStyle = "rgba(0,0,0,0.5)";
                        ctx.fillText(`${((confidence*100).toFixed(1))}%`, minX + 4, minY - barHeight - 6);
                        ctx.fillRect(minX, minY - barHeight - 2, boxWidth, barHeight);

                        // fill
                        ctx.fillStyle = "yellow";
                        ctx.fillRect(minX, minY - barHeight - 2, barWidth, barHeight);

                        // optional text
                        ctx.fillStyle = "white";
                        ctx.font = "12px Arial";
                        ctx.fillText(`${(confidence*100).toFixed(1)}%`, minX + 4, minY - barHeight - 6);
                    }
                });

                const msg = `Detected Hands: ${results.multiHandLandmarks.length}`;
                setGestures(msg);
                if (onGesturesChange) {
                    onGesturesChange(msg);
                }

                await sendFrameToBackend(canvas);
            } else {
                const msg = "No hands detected";
                setGestures(msg);
                if (onGesturesChange) {
                    onGesturesChange(msg);
                }
            }

            // --- restore after flipping
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
                if (onGesturesChange) {
                    onGesturesChange(msg);
                }
            }
        })();

        return () => {
            cancelAnimationFrame(requestRef.current);
            videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop());
        };
    }, [onGesturesChange]);

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
