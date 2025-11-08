import React, { useEffect, useRef, useState } from "react";
import { Hands,HAND_CONNECTIONS} from "@mediapipe/hands";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

const CameraFeed = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const handsRef = useRef(null);
    const requestRef = useRef(null);
    const [gestures, setGestures] = useState("");

    useEffect(() => {
        //Initialize MediaPipe Hands
        handsRef.current = new Hands({
            locateFile: (file) =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
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

            if (!videoRef.current) return;

            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Mirror the image horizontally like a selfie
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);

            // Draw the mirrored video frame
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

            // 👇 Only change: also require at least one landmark set
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const HAND_CONNECTIONS = [
                    [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
                    [0, 5], [5, 6], [6, 7], [7, 8],       // Index
                    [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
                    [0, 13], [13, 14], [14, 15], [15, 16],// Ring
                    [0, 17], [17, 18], [18, 19], [19, 20] // Pinky
                ];

                for (const landmarks of results.multiHandLandmarks) {
                    // Draw hand landmarks
                    drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
                        color: "#00FF00",
                        lineWidth: 5,
                    });
                    drawLandmarks(ctx, landmarks, { color: "#FF0000", lineWidth: 2 });

                    // Flatten landmarks for TensorFlow
                    const inputVector = landmarks.flatMap((l) => [l.x, l.y, l.z]);

                    // TODO: Feed inputVector into your TensorFlow gesture model
                    // const prediction = yourTFModel.predict(tf.tensor([inputVector]));
                    // setGestures(predictedGesture);

                    // For now, just show detected hands count
                    setGestures(`Detected Hands: ${results.multiHandLandmarks.length}`);
                }
            } else {
                setGestures("No hands detected");
            }

            ctx.restore();
        });

        // Start webcam
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false,
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;

                    // Wait until video metadata is loaded
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current.play();

                        // Start frame loop after video is ready
                        const processFrame = async () => {
                            if (handsRef.current) {
                                await handsRef.current.send({ image: videoRef.current });
                            }
                            requestRef.current = requestAnimationFrame(processFrame);
                        };

                        requestRef.current = requestAnimationFrame(processFrame);
                    };
                }
            } catch (err) {
                console.error("Error accessing camera: ", err);
            }
        };

        startCamera();

        // Cleanup on unmount
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const tracks = videoRef.current.srcObject.getTracks();
                tracks.forEach((track) => track.stop());
            }
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    return (
        <div>
            <h2>Live Camera Feed + Hand Detection</h2>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ display: "none" }} // hide video, show canvas
            />
            <canvas
                ref={canvasRef}
                style={{
                    width: "640px",
                    borderRadius: "12px",
                    backgroundColor: "#1e1e1e", // subtle backdrop so you can see the rounded edges
                    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.6)", // shadow that separates it from background
                }}
            />
            <div style={{marginTop: "10px", fontSize: "18px"}}>{gestures}</div>
        </div>
    );
};

export default CameraFeed;
