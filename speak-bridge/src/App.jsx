import { useState, useMemo, useRef } from "react";
import CameraFeed from "./Camera";

const SQUARE_COUNT = 80;

const PURPLE_COLORS = [
  "#a855f7",
  "#7c3aed",
  "#c4b5fd",
  "#d8b4fe",
  "#4c1d95",
];

function App() {
  const placeholderText =
    "No translation yet. This will show recognized sign language as text.\nPlace your hands in view of the camera to start translating sign language";

  const [handStatus, setHandStatus] = useState("Waiting for hand signs…");
  const [outputText, setOutputText] = useState(placeholderText);
  const [theme, setTheme] = useState("dark");
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const isDark = theme === "dark";
  const audioRef = useRef(new Audio());

  // Function to request speech from backend
  const playSpeech = async () => {
    if (!outputText || outputText === placeholderText || isSpeaking) {
      console.log("Speech blocked:", { hasText: !!outputText, isPlaceholder: outputText === placeholderText, isSpeaking });
      return;
    }

    try {
      setIsSpeaking(true);
      console.log("Requesting speech for:", outputText);

      const formData = new FormData();
      formData.append("text", outputText);

      const response = await fetch("http://127.0.0.1:8000/api/speak", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${errorText}`);
      }

      const blob = await response.blob();
      console.log("Received audio blob:", blob.size, "bytes");
      
      const audioURL = URL.createObjectURL(blob);

      // Clean up previous audio URL
      if (audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
      }

      audioRef.current.src = audioURL;
      audioRef.current.onended = () => {
        console.log("Audio playback ended");
        setIsSpeaking(false);
        URL.revokeObjectURL(audioURL);
      };
      audioRef.current.onerror = (e) => {
        console.error("Audio playback error:", e);
        setIsSpeaking(false);
        URL.revokeObjectURL(audioURL);
      };

      await audioRef.current.play();
      console.log("Audio playback started");
    } catch (err) {
      console.error("Speech error:", err);
      alert(`Speech Error: ${err.message}`);
      setIsSpeaking(false);
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const squares = useMemo(() => {
    return Array.from({ length: SQUARE_COUNT }).map((_, i) => {
      const left = Math.random() * 100;
      const size = 10 + Math.random() * 20;
      const delay = Math.random() * 8;
      const duration = 6 + Math.random() * 6;
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
    <div
      className={
        "relative min-h-screen flex items-center justify-center px-4 md:px-6 py-6 overflow-hidden " +
        (isDark ? "text-[#f3e9ff]" : "text-slate-900")
      }
    >
      <div
        className={
          "absolute inset-0 -z-20 " +
          (isDark ? "bg-[#050012]" : "bg-slate-100")
        }
      />

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

      <div
        className={
          "w-full max-w-6xl overflow-hidden flex flex-col backdrop-blur-sm rounded-2xl border " +
          (isDark
            ? "bg-[#1a1028]/80 border-[#3c1361] shadow-[0_20px_60px_rgba(64,0,128,0.6)]"
            : "bg-white/90 border-purple-200 shadow-none")
        }
      >
        <header
          className={
            "flex items-center justify-between px-4 md:px-6 py-1.5 border-b bg-transparent mt-0 " +
            (isDark ? "border-[#3c1361]" : "border-purple-200")
          }
        >
          <div className="flex items-center gap-2 py-1">
            <img
              src="/src/assets/logo.png"
              alt="SpeakBridge Logo"
              className={
                "h-10 w-10 rounded-xl " +
                (isDark
                  ? "shadow-[0_0_10px_rgba(147,51,234,0.8)]"
                  : "shadow-none")
              }
            />

            <h1
              className={
                "m-0 text-xl md:text-2xl font-bold leading-none " +
                (isDark ? "text-purple-200" : "text-purple-700")
              }
            >
              SpeakBridge
            </h1>
          </div>

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

        <main
          className={
            "px-4 md:px-6 py-3 min-h-0 flex-1 " +
            (isDark ? "bg-[#1a1028]/80" : "bg-white/80")
          }
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <div
                className={
                  "rounded-xl overflow-hidden border " +
                  (isDark
                    ? "bg-[#2a1b3d] border-[#4c1d95]"
                    : "bg-white border-purple-200 shadow-none")
                }
              >
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

                <div className="aspect-[4/3] bg-black/60 flex items-center justify-center">
                  <CameraFeed
                    onGesturesChange={setHandStatus}
                    onRecognizedText={setOutputText}
                    canvasClassName="w-full h-full rounded-none"
                  />
                </div>
              </div>

              <div
                className={
                  "rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2 border " +
                  (isDark
                    ? "bg-[#2a1b3d] border-[#4c1d95] text-purple-100"
                    : "bg-purple-50 border-purple-200 text-purple-900 shadow-none")
                }
              >
                <span className="truncate">{handStatus}</span>

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

            <div
              className={
                "rounded-xl flex flex-col border " +
                (isDark
                  ? "bg-[#2a1b3d] border-[#4c1d95] shadow-[0_0_20px_rgba(147,51,234,0.25)]"
                  : "bg-white border-purple-200 shadow-none")
              }
            >
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
                <button
                  onClick={playSpeech}
                  disabled={isSpeaking || outputText === placeholderText}
                  className={
                    "uppercase tracking-wide flex items-center gap-1 px-2 py-1 rounded transition " +
                    (isDark
                      ? "text-purple-300/70 hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      : "text-purple-600 font-semibold hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed")
                  }
                  title={outputText === placeholderText ? "No text to speak" : "Click to hear the text"}
                >
                  {isSpeaking ? "🔊 Playing..." : "🔊 Speak"}
                </button>
              </div>

              <div className="px-3 py-3 flex-1 overflow-y-auto">
                <p
                  className={
                    "whitespace-pre-line text-sm md:text-base leading-relaxed " +
                    (isDark ? "text-purple-100" : "text-slate-900") +
                    (outputText === placeholderText
                      ? " opacity-60"
                      : " opacity-100")
                  }
                >
                  {outputText}
                </p>
              </div>
            </div>
          </div>
        </main>

        <footer
          className={
            "px-4 md:px-6 py-2 border-t text-[0.75rem] text-center bg-transparent " +
            (isDark
              ? "border-[#3c1361] text-purple-100/90"
              : "border-purple-200 text-slate-600 font-medium")
          }
        >
          <p>Speak Bridge © 2025 • Made w/ ❤️</p>
        </footer>
      </div>
    </div>
  );
}

export default App;