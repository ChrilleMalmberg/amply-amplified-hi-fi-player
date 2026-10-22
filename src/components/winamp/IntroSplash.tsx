import { useEffect, useRef, useState } from "react";
import { Power, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import officialLogo from "@/assets/amply-official-startup.jpg.asset.json";
import { playStartupSound, STARTUP_DURATION_MS } from "@/lib/startup-sound";

export function IntroSplash({ onDone }: { onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const sound = useRef<ReturnType<typeof playStartupSound>>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => () => {
    sound.current?.stop();
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const finish = () => {
    sound.current?.stop();
    if (timer.current) clearTimeout(timer.current);
    done.current();
  };
  const start = () => {
    if (running) return;
    setRunning(true);
    if (!muted) {
      try {
        sound.current = playStartupSound();
        if (!sound.current) setSoundBlocked(true);
        void sound.current?.ready.catch(() => setSoundBlocked(true));
      } catch { setSoundBlocked(true); }
    }
    timer.current = setTimeout(finish, STARTUP_DURATION_MS);
  };
  const toggleSound = () => {
    if (!muted) sound.current?.stop();
    setMuted(value => !value);
  };

  return (
    <div className="wa-intro wa-neon-startup" data-running={running} role="dialog" aria-modal="true" aria-label="AmPly startup">
      <div className="wa-neon-sign">
        <img className="wa-startup-logo" src={officialLogo.url} alt="AmPLy — Amplified Hi-Fi PlaYer, orange lightning bolt official logo" />
        <div className="wa-startup-lights" aria-hidden="true">
          {Array.from({ length: 16 }, (_, index) => <span key={index} />)}
        </div>
      </div>
      <div className="wa-startup-controls">
        {!running && <Button variant="retro" size="retro" className="wa-startup-power" onClick={start}><Power /> Power on</Button>}
        {running && <span className="wa-startup-status" role="status">POWERING ON</span>}
        <Button variant="retro" size="retro" className="wa-startup-icon" onClick={toggleSound} disabled={running && muted} aria-label={muted ? "Enable startup sound" : "Mute startup sound"} title={muted ? "Enable startup sound" : "Mute startup sound"} aria-pressed={muted}>{muted ? <VolumeX /> : <Volume2 />}</Button>
        <Button variant="retro" size="retro" className="wa-startup-icon" onClick={finish} aria-label="Skip startup" title="Skip startup"><SkipForward /></Button>
      </div>
      {soundBlocked && <span role="status" className="wa-startup-audio-notice">Startup sound unavailable</span>}
    </div>
  );
}
