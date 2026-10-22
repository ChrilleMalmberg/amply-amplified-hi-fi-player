import { AmplyLogo } from "./AmplyLogo";

export function IntroSplash({ onDone }: { onDone: () => void }) {
  return (
    <button className="wa-intro" onClick={onDone}>
      <AmplyLogo size={64} />
      <span className="wa-intro-sub">HiFi Audio Player · V-2.1</span>
      <span className="wa-intro-click wa-blink">Click to start</span>
    </button>
  );
}
