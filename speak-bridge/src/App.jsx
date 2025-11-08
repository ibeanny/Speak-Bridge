import CameraFeed from "./Camera";
import "./App.css";

function App() {
  return (
    <div className="App">
      <header>
        <h1>Speak Bridge</h1>
        <p>Bridging communication between sign and speech</p>
      </header>

      <main>
        <section id="camera-section">
          <CameraFeed />
        </section>

        <section id="output-section">
          <h2>Translated Text</h2>
          <div id="output-box">Your translation will appear here...</div>
        </section>
      </main>

      <footer>
        <p>© 2025 Speak Bridge</p>
      </footer>
    </div>
  );
}

export default App;
