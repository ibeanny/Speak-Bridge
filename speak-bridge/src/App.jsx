import { useState, useMemo } from "react";
import CameraFeed from "./Camera"; // custom camera component

// How many floating squares you want
const SQUARE_COUNT = 80;

// Purple shades to pick from
const PURPLE_COLORS = [
  "#a855f7", // bright purple
  "#7c3aed", // deep purple
  "#c4b5fd", // soft lavender
  "#d8b4fe", // pale pinky purple
  "#4c1d95", // dark indigo
];

function App() {
  // Text shown before any sign language is translated
  const placeholderText =
    "No translation yet. This will show recognized sign language as text.\n  Place your hands in view of the camera to start translating sign language";

  // Tracks what the camera thinks your hands are doing
  const [handStatus, setHandStatus] = useState("Waiting for hand signs…");

  // This will eventually hold the translated sign language text
  // For now, it just uses the placeholder
  const [outputText] = useState(placeholderText);

  // Pre-generate square configs so they don't change every re-render
  const squares = useMemo(() => {
    return Array.from({ length: SQUARE_COUNT }).map((_, i) => {
      const left = Math.random() * 100; // 0–100% horizontally
      const size = 10 + Math.random() * 20; // 10–30 px
      const delay = Math.random() * 8; // 0–8s delay
      const duration = 6 + Math.random() * 6; // 6–12s rise time
      const color =
        PURPLE_COLORS[Math.floor(Math.random() * PURPLE_COLORS.length)];

      return {
        id: i,
        left,
        size,
        delay,
        duration,
        color,
      };
    });
  }, []);

  return (
    // ============================
    // OUTER PAGE CONTAINER
    // - Full-screen layout
    // - Custom animated background behind the main card
    // ============================
    <div className="relative min-h-screen flex justify-center px-4 md:px-6 pt-6 pb-4 text-[#f3e9ff] overflow-hidden">
      {/* Dark base background */}
      <div className="absolute inset-0 -z-20 bg-[#050012]" />

      {/* Purple "fire" square effect */}
      <div className="pointer-events-none absolute inset-0 -z-10 purple-fire">
        {squares.map((sq) => (
          <span
            key={sq.id}
            style={{
              left: `${sq.left}%`,
              width: `${sq.size}px`,
              height: `${sq.size}px`,
              backgroundColor: sq.color,
              animationDelay: `${sq.delay}s`,
              animationDuration: `${sq.duration}s`,
            }}
          />
        ))}
      </div>

      {/*
        MAIN APP CARD
        - The glowing purple box in the middle
        - Slightly transparent so the background still shows
      */}
      <div className="w-full max-w-6xl bg-[#1a1028]/80 border border-[#3c1361] rounded-2xl shadow-[0_20px_60px_rgba(64,0,128,0.6)] overflow-hidden flex flex-col backdrop-blur-sm">
        {/* ============================
            HEADER
            - Icon + app title
           ============================ */}
        <header className="flex items-center px-4 md:px-6 py-1.5 border-b border-[#3c1361] bg-transparent mt-0">
          <div className="flex items-center gap-2 py-1">
            {/* Logo image (icon.png) */}
            <img
              src="/src/assets/icon.png" // path to your icon file
              alt="SpeakBridge Icon"
              className="h-10 w-10 rounded-xl shadow-[0_0_10px_rgba(147,51,234,0.8)]"
            />

            {/* App name text */}
            <h1 className="m-0 text-xl md:text-2xl font-bold text-purple-200 leading-none">
              SpeakBridge
            </h1>
          </div>
        </header>

        {/* ============================
            MAIN CONTENT AREA
            - Left: camera + status
            - Right: recognized text
           ============================ */}
        <main className="px-4 md:px-6 py-3 bg-[#1a1028]/80 min-h-0">
          <div className="grid md:grid-cols-2 gap-4">
            {/* ============================
                LEFT COLUMN
                - Camera box
                - Hand status box
               ============================ */}
            <div className="flex flex-col gap-2">
              {/* CAMERA BOX */}
              <div className="bg-[#2a1b3d] border border-[#4c1d95] rounded-xl overflow-hidden shadow-[0_0_25px_rgba(147,51,234,0.3)]">
                {/* Camera header strip */}
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#4c1d95]/50 text-[0.7rem] text-purple-200/70">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-400" />
                    Live Camera Feed
                  </span>
                  <span className="uppercase tracking-wide text-purple-300/70">
                    Input Zone
                  </span>
                </div>

                {/* Camera feed area */}
                <div className="aspect-[4/3] bg-black/60 flex items-center justify-center">
                  <CameraFeed
                    onGesturesChange={setHandStatus} // updates handStatus text
                    canvasClassName="w-full h-full rounded-none" // styles for overlay canvas
                  />
                </div>
              </div>

              {/* HAND STATUS BOX */}
              <div className="bg-[#2a1b3d] border border-[#4c1d95] rounded-lg px-3 py-2 text-sm text-purple-100 shadow-[0_0_15px_rgba(147,51,234,0.2)] flex items-center justify-between gap-2">
                {/* Text showing what the system sees */}
                <span className="truncate">{handStatus}</span>

                {/* "Camera Active" pill + pulse dot */}
                <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/60 bg-purple-500/20 px-2 py-0.5 text-[0.6rem] font-semibold text-purple-200 uppercase tracking-wide whitespace-nowrap">
                  <span className="h-2 w-2 rounded-full bg-purple-300 animate-pulse" />
                  Camera Active
                </span>
              </div>
            </div>

            {/* ============================
                RIGHT COLUMN
                - Recognized / translated text
               ============================ */}
            <div className="bg-[#2a1b3d] border border-[#4c1d95] rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.25)] flex flex-col">
              {/* Output header strip */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#4c1d95]/50 text-[0.7rem] text-purple-200/70">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-purple-400" />
                  Recognized Text
                </span>
                <span className="uppercase tracking-wide text-purple-300/70">
                  Output
                </span>
              </div>

              {/* Output text area */}
              <div className="px-3 py-3">
                <p
                  className={
                    "whitespace-pre-line text-sm md:text-base text-purple-100 leading-relaxed " +
                    (outputText === placeholderText
                      ? "opacity-60" // faded style when it's just the placeholder
                      : "opacity-100") // full brightness when it's real output
                  }
                >
                  {outputText}
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* ============================
            FOOTER
            - Credits line
           ============================ */}
        <footer className="px-4 md:px-6 py-2 border-t border-[#3c1361] text-[0.75rem] text-purple-100/90 text-center bg-transparent">
          <p>Speak Bridge © 2025 • Made w/ ❤️ by Elvis Ortiz</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
