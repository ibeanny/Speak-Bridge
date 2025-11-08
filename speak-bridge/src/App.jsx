import { useState } from "react";
import CameraFeed from "./Camera";

function App() {
    const placeholderText =
        "No translation yet. This will show recognized sign language as text.\n  Place your hands in view of the camera to start translating sign language";


    const [handStatus, setHandStatus] = useState("Waiting for hand signs…");
    const [outputText] = useState(placeholderText); // later replace with real translated text

    return (
        <div className="bg-[#120c1c] text-[#f3e9ff] min-h-screen flex justify-center px-4 md:px-6 pt-6 pb-4">
            <div className="w-full max-w-6xl bg-[#1a1028] border border-[#3c1361] rounded-2xl shadow-[0_20px_60px_rgba(64,0,128,0.6)] overflow-hidden flex flex-col">

                {/* HEADER */}
                <header className="flex items-center px-4 md:px-6 h-[48px] border-b border-[#3c1361] bg-transparent">
                    <div className="flex items-center gap-2">
                        {/* Icon */}
                        <div className="h-9 w-9 rounded-lg bg-[#4c1d95]/30 flex items-center justify-center text-lg md:text-xl font-bold text-purple-200 shadow-[0_0_10px_rgba(147,51,234,0.8)]">
                            SB
                        </div>
                        {/* Title */}
                        <h1 className="m-0 text-xl md:text-2xl font-bold text-white leading-none">
                            Speak Bridge
                        </h1>
                    </div>
                </header>

                {/* MAIN */}
                <main className="px-4 md:px-6 py-3 bg-[#1a1028]">
                    <div className="grid md:grid-cols-2 gap-4">

                        {/* LEFT COLUMN: Camera + Hands Detected */}
                        <div className="flex flex-col gap-2">
                            {/* Camera */}
                            <div className="bg-[#2a1b3d] border border-[#4c1d95] rounded-xl overflow-hidden shadow-[0_0_25px_rgba(147,51,234,0.3)]">
                                <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#4c1d95]/50 text-[0.7rem] text-purple-200/70">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-400" />
                    Live Camera Feed
                  </span>
                                    <span className="uppercase tracking-wide text-purple-300/70">
                    Input Zone
                  </span>
                                </div>
                                <div className="aspect-[4/3] bg-black/60 flex items-center justify-center">
                                    <CameraFeed
                                        onGesturesChange={setHandStatus}
                                        canvasClassName="w-full h-full rounded-none"
                                    />
                                </div>
                            </div>

                            {/* Hands Detected + Camera Active */}
                            <div className="bg-[#2a1b3d] border border-[#4c1d95] rounded-lg px-3 py-2 text-sm text-purple-100 shadow-[0_0_15px_rgba(147,51,234,0.2)] flex items-center justify-between gap-2">
                                <span className="truncate">{handStatus}</span>
                                <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/60 bg-purple-500/20 px-2 py-0.5 text-[0.6rem] font-semibold text-purple-200 uppercase tracking-wide whitespace-nowrap">
                  <span className="h-2 w-2 rounded-full bg-purple-300 animate-pulse" />
                  Camera Active
                </span>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Recognized Text */}
                        <div className="bg-[#2a1b3d] border border-[#4c1d95] rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.25)] flex flex-col">
                            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#4c1d95]/50 text-[0.7rem] text-purple-200/70">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-purple-400" />
                  Recognized Text
                </span>
                                <span className="uppercase tracking-wide text-purple-300/70">
                  Output
                </span>
                            </div>

                            <div className="px-3 py-3">
                                <p
                                    className={
                                        "whitespace-pre-line text-sm md:text-base text-purple-100 leading-relaxed " +
                                        (outputText === placeholderText ? "opacity-60" : "opacity-100")
                                    }
                                >
                                    {outputText}
                                </p>

                            </div>
                        </div>
                    </div>
                </main>

                {/* FOOTER */}
                <footer
                    className="px-4 md:px-6 py-2 border-t border-[#3c1361] text-[0.75rem] text-purple-100/90 text-center bg-transparent">
                    <p>Speak Bridge © 2025 • Made w/ ❤️ by Elvis Ortiz</p>
                </footer>
            </div>
        </div>
    );
}

export default App;
