import llama from "@/assets/llama.png";

function jingle() {
  const ctx = new AudioContext();
  const notes = [392, 523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = f;
    const t = ctx.currentTime + 2.4 + i * 0.12;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.35);
  });
  setTimeout(() => ctx.close(), 4000);
}

export function IntroSplash({ onDone }: { onDone: () => void }) {
  const start = () => {
    try {
      const u = new SpeechSynthesisUtterance("It really whips the llama's ass!");
      u.pitch = 0.1;
      u.rate = 0.85;
      speechSynthesis.speak(u);
    } catch {
      /* speech not available */
    }
    jingle();
    onDone();
  };
  return (
    <button className="wa-intro" onClick={start}>
      <img src={llama} alt="Pixel llama" width={816} height={816} className="wa-intro-llama" />
      <span className="wa-intro-title">WINAMP</span>
      <span className="wa-intro-sub">It really whips the llama's ass!</span>
      <span className="wa-intro-click wa-blink">Click to start</span>
    </button>
  );
}
