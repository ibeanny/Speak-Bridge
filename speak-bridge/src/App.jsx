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
  const [outputText, setOutputText] = useState(placeholderText);

  // Theme state: "dark" (current look) or "light"
  const [theme, setTheme] = useState("dark");
  const isDark = theme === "dark";

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

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
    <div
      className={
        "relative min-h-screen flex items-center justify-center px-4 md:px-6 py-6 overflow-hidden " +
        (isDark ? "text-[#f3e9ff]" : "text-slate-900")
      }
    >
      {/* Dark base background */}
      <div
        className={
          "absolute inset-0 -z-20 " +
          (isDark ? "bg-[#050012]" : "bg-slate-100")
        }
      />

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
      <div
        className={
          "w-full max-w-6xl overflow-hidden flex flex-col backdrop-blur-sm rounded-2xl border " +
          (isDark
            ? "bg-[#1a1028]/80 border-[#3c1361] shadow-[0_20px_60px_rgba(64,0,128,0.6)]"
            : "bg-white/90 border-purple-200 shadow-none")
        }
      >
        {/* ============================
            HEADER
            - Icon + app title
           ============================ */}
        <header
          className={
            "flex items-center justify-between px-4 md:px-6 py-1.5 border-b bg-transparent mt-0 " +
            (isDark ? "border-[#3c1361]" : "border-purple-200")
          }
        >
          <div className="flex items-center gap-2 py-1">
            {/* Logo image (icon.png) */}
            <img
              src="/src/assets/icon.png" // path to your icon file
              alt="SpeakBridge Icon"
              className={
                "h-10 w-10 rounded-xl " +
                (isDark
                  ? "shadow-[0_0_10px_rgba(147,51,234,0.8)]"
                  : "shadow-none")
              }
            />

            {/* App name text */}
            <h1
              className={
                "m-0 text-xl md:text-2xl font-bold leading-none " +
                (isDark ? "text-purple-200" : "text-purple-700")
              }
            >
              SpeakBridge
            </h1>
          </div>

          {/* Theme toggle button (right side of header) */}
          <button
            type="button"
            onClick={toggleTheme}
            className={
              "text-xs md:text-sm px-3 py-1 rounded-full border transition " +
              (isDark
                ? "border-purple-400/70 bg-purple-500/20 text-purple-100 hover:bg-purple-500/30"
                : "border-purple-400/70 bg-purple-100 text-purple-900 hover:bg-purple-200")
            }
          >
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>
        </header>

        {/* ============================
            MAIN CONTENT AREA
            - Left: camera + status
            - Right: recognized text
           ============================ */}
        <main
          className={
            "px-4 md:px-6 py-3 min-h-0 flex-1 " +
            (isDark ? "bg-[#1a1028]/80" : "bg-white/80")
          }
        >
          <div className="grid md:grid-cols-2 gap-4">
            {/* ============================
                LEFT COLUMN
                - Camera box
                - Hand status box
               ============================ */}
            <div className="flex flex-col gap-2">
              {/* CAMERA BOX */}
              <div
                className={
                  "rounded-xl overflow-hidden border " +
                  (isDark
                    ? "bg-[#2a1b3d] border-[#4c1d95]"
                    : "bg-white border-purple-200 shadow-none")
                }
              >
                {/* Camera header strip */}
                <div
                  className={
                    "flex items-center justify-between px-3 py-1.5 border-b text-[0.7rem] " +
                    (isDark
                      ? "border-[#4c1d95]/50 text-purple-200/70"
                      : "border-purple-200 text-purple-700/80 font-medium")
                  }
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-400" />
                    Live Camera Feed
                  </span>
                  <span
                    className={
                      "uppercase tracking-wide " +
                      (isDark
                        ? "text-purple-300/70"
                        : "text-purple-600 font-semibold")
                    }
                  >
                    Input Zone
                  </span>
                </div>

                {/* Camera feed area */}
                <div className="aspect-[4/3] bg-black/60 flex items-center justify-center">
                  <CameraFeed
                    onGesturesChange={setHandStatus} // updates handStatus text
                    onRecognizedText={setOutputText}
                    canvasClassName="w-full h-full rounded-none" // styles for overlay canvas
                  />
                </div>
              </div>

              {/* HAND STATUS BOX */}
              <div
                className={
                  "rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2 border " +
                  (isDark
                    ? "bg-[#2a1b3d] border-[#4c1d95] text-purple-100"
                    : "bg-purple-50 border-purple-200 text-purple-900 shadow-none")
                }
              >
                {/* Text showing what the system sees */}
                <span className="truncate">{handStatus}</span>

                {/* "Camera Active" pill + pulse dot */}
                <span
                  className={
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide whitespace-nowrap " +
                    (isDark
                      ? "border-purple-400/60 bg-purple-500/20 text-purple-200"
                      : "border-purple-300 bg-purple-50 text-purple-700")
                  }
                >
                  <span
                    className={
                      "h-2 w-2 rounded-full animate-pulse " +
                      (isDark ? "bg-purple-300" : "bg-purple-700")
                    }
                  />
                  Camera Active
                </span>
              </div>
            </div>

            {/* ============================
                RIGHT COLUMN
                - Recognized / translated text
               ============================ */}
            <div
              className={
                "rounded-xl flex flex-col border " +
                (isDark
                  ? "bg-[#2a1b3d] border-[#4c1d95] shadow-[0_0_20px_rgba(147,51,234,0.25)]"
                  : "bg-white border-purple-200 shadow-none")
              }
            >
              {/* Output header strip */}
              <div
                className={
                  "flex items-center justify-between px-3 py-1.5 border-b text-[0.7rem] " +
                  (isDark
                    ? "border-[#4c1d95]/50 text-purple-200/70"
                    : "border-purple-200 text-purple-700/80 font-medium")
                }
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-purple-400" />
                  Recognized Text
                </span>
                <span
                  className={
                    "uppercase tracking-wide " +
                    (isDark
                      ? "text-purple-300/70"
                      : "text-purple-600 font-semibold")
                  }
                >
                  Output
                </span>
              </div>

              {/* Output text area */}
              <div className="px-3 py-3">
                <p
                  className={
                    "whitespace-pre-line text-sm md:text-base leading-relaxed " +
                    (isDark ? "text-purple-100" : "text-slate-900") +
                    (outputText === placeholderText
                      ? " opacity-60" // faded style when it's just the placeholder
                      : " opacity-100") // full brightness when it's real output
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
        <footer
          className={
            "px-4 md:px-6 py-2 border-t text-[0.75rem] text-center bg-transparent " +
            (isDark
              ? "border-[#3c1361] text-purple-100/90"
              : "border-purple-200 text-slate-600 font-medium")
          }
        >
          <p>Speak Bridge © 2025 • Made w/ ❤️ by Elvis Ortiz</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
