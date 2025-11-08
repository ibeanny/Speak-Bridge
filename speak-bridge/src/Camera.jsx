import { useEffect, useRef } from "react";

const CameraFeed = () =>{

    const videoRef = useRef(null)

    useEffect(() =>{

        const startCamera = async ()=>{
            try{
                const stream = await navigator.mediaDevices.getUserMedia({
                    video : true,
                    audio : false,
                })

                if(videoRef.current){
                    videoRef.current.srcObject = stream;

                }
            }catch(err){
                console.error("Error accessing the camera: ", err)
            }  

        };
        startCamera();

        return () =>{
            if(videoRef.current && videoRef.current.srcObject){
                const tracks = videoRef.current.srcObject.getTracks();
                tracks.forEach((track) => track.stop());
            }
        };


    }, []);





    return (
        <div>
            <h2>Live Camera Feed</h2>
            <video ref = {videoRef}
            autoPlay
            playsInline
            muted
            style={{width :"600px", borderRadius :"10px"}}
            />

        </div>
    );
};

export default CameraFeed;  