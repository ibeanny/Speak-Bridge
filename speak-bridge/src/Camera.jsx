import { useEffect, useRef } from "react";

const CameraFeed = () => {
  const videoRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing the camera:", err);
    }
  };

  useEffect(() => {
    startCamera(); // automatically start the camera when component mounts

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div id="camera-container">
      <video
        ref={videoRef}
        id="camera"
        autoPlay
        playsInline
        muted
        style={{ width: "350px", borderRadius: "10px" }}
      />
    </div>
  );
};

export default CameraFeed;
