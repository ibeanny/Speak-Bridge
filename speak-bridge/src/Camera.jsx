import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

// Hand skeleton connections
const HAND_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
];

export default function CameraFeed({ onGesturesChange, canvasClassName }) {
    const videoRef = useRef(null);   // <video> element
    const canvasRef = useRef(null);  // <canvas> element
    const handsRef = useRef(null);   // MediaPipe Hands instance
    const requestRef = useRef(null); // requestAnimationFrame id

    const [gestures, setGestures] = useState("Starting camera...");

    // Send current canvas frame to backend as PNG
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
        // Init MediaPipe Hands
        handsRef.current = new Hands({
            locateFile: (file) =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        // Hand detection options
        handsRef.current.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5,
        });

        // Callback when MediaPipe returns results
        handsRef.current.onResults(async (results) => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            const video = videoRef.current;
            if (!video) return;

            // Match canvas to video size
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Mirror canvas horizontally (selfie view)
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);

            // Draw camera frame
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

            if (results.multiHandLandmarks?.length > 0) {
                results.multiHandLandmarks.forEach((lm, idx) => {
                    // Draw hand connections + points
                    drawConnectors(ctx, lm, HAND_CONNECTIONS, {
                        color: "#00FF88",
                        lineWidth: 4,
                    });
                    drawLandmarks(ctx, lm, {
                        color: "#FF3355",
                        lineWidth: 2,
                    });

                    // Confidence / handedness info
                    if (results.multiHandedness && results.multiHandedness[idx]) {
                        const confidence = results.multiHandedness[idx].score; // 0–1

                        // Get bounding box in pixel space
                        const xs = lm.map((p) => p.x * canvas.width);
                        const ys = lm.map((p) => p.y * canvas.height);
                        const minX = Math.min(...xs);
                        const maxX = Math.max(...xs);
                        const minY = Math.min(...ys);
                        const maxY = Math.max(...ys);

                        const boxWidth = maxX - minX;
                        const boxHeight = maxY - minY;

                        // Draw box around hand (still mirrored)
                        ctx.strokeStyle = "yellow";
                        ctx.lineWidth = 2;
                        ctx.strokeRect(minX, minY, boxWidth, boxHeight);

                        // Confidence bar above box (mirrored)
                        const barWidth = boxWidth * confidence;
                        const barHeight = 6;

                        ctx.fillStyle = "rgba(0,0,0,0.5)";
                        ctx.fillRect(minX, minY - barHeight - 2, boxWidth, barHeight);

                        ctx.fillStyle = "yellow";
                        ctx.fillRect(minX, minY - barHeight - 2, barWidth, barHeight);

                        // ---------- FIX: draw text unmirrored ----------

                        // Flip X so text lines up with mirrored box position
                        const visualLeft = canvas.width - maxX; // where box's left appears on screen
                        const textX = visualLeft + 4;           // slight padding inside box
                        const textY = minY - barHeight - 6;     // above the bar
                        const text = `${(confidence * 100).toFixed(1)}%`;

                        // Reset transform so text isn't backwards
                        ctx.save();
                        ctx.setTransform(1, 0, 0, 1, 0, 0);     // identity matrix
                        ctx.fillStyle = "white";
                        ctx.font = "12px Arial";
                        ctx.fillText(text, textX, textY);
                        ctx.restore();
                    }
                });

                const msg = `Detected Hands: ${results.multiHandLandmarks.length}`;
                setGestures(msg);
                if (onGesturesChange) onGesturesChange(msg);

                await sendFrameToBackend(canvas);
            } else {
                const msg = "No hands detected";
                setGestures(msg);
                if (onGesturesChange) onGesturesChange(msg);
            }

            // Restore original transform (undo mirror)
            ctx.restore();
        });

        // Ask for camera and start processing loop
        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false,
                });
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
                if (onGesturesChange) onGesturesChange(msg);
            }
        })();

        // Cleanup camera + loop on unmount
        return () => {
            cancelAnimationFrame(requestRef.current);
            videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop());
        };
    }, [onGesturesChange]);

    return (
        <div>
            {/* Hidden video: used only as source for MediaPipe */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ display: "none" }}
            />
            {/* Visible canvas with camera + overlays */}
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
