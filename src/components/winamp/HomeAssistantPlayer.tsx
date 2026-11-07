import { useEffect, useRef } from 'react';
import { desktopBridge, type HomeAssistantCommand, type HomeAssistantSnapshot } from '@/lib/desktop-bridge';
import { usePlayer, type PlayerApi } from './player-context';

export function homeAssistantSnapshot(p: PlayerApi, ready: boolean): HomeAssistantSnapshot {
  const track = p.tracks[p.current];
  return { state: !p.playing ? 'idle' : p.paused ? 'paused' : 'playing', title: track?.title || '',
    track_id: track ? String(track.id) : '', position: p.time, duration: p.duration, volume: p.volume,
    muted: p.muted, track_count: p.tracks.length, ready };
}

export function applyHomeAssistantCommand(p: PlayerApi, command: HomeAssistantCommand) {
  switch (command.action) {
    case 'play': if (!p.tracks.length) throw Error('No tracks'); p.play(); break;
    // The desktop pause button is a toggle; remote pause must be idempotent.
    case 'pause': p.pauseOnly(); break;
    case 'stop': p.stop(); break;
    case 'next': if (!p.tracks.length) throw Error('No tracks'); p.next(); break;
    case 'previous': if (!p.tracks.length) throw Error('No tracks'); p.prev(); break;
    case 'volume_set':
      if (typeof command.value !== 'number' || !Number.isFinite(command.value) || command.value < 0 || command.value > 1) throw Error('Invalid volume');
      p.setVolume(command.value); break;
    case 'volume_mute': if (typeof command.value !== 'boolean') throw Error('Invalid mute'); p.setMuted(command.value); break;
    case 'seek':
      if (typeof command.value !== 'number' || !Number.isFinite(command.value) || command.value < 0 || !p.duration) throw Error('Invalid seek');
      p.seek(Math.min(command.value, p.duration)); break;
    default: throw Error('Unsupported command');
  }
}

/** Mounted only in the audio-owning native main window. No second audio graph. */
export function HomeAssistantPlayer({ ready }: { ready: boolean }) {
  const p = usePlayer();
  const current = useRef({ p, ready }); current.current = { p, ready };
  useEffect(() => {
    const bridge = desktopBridge();
    if (!bridge?.publishHomeAssistantState) return;
    const publish = () => bridge.publishHomeAssistantState(homeAssistantSnapshot(current.current.p, current.current.ready));
    publish();
    const timer = setInterval(publish, 1000);
    const unsubscribe = bridge.onHomeAssistantCommand(request => {
      let ok = false;
      try { if (!current.current.ready) throw Error('Startup incomplete'); applyHomeAssistantCommand(current.current.p, request.command); ok = true; }
      catch { /* Report a bounded failure; never send file paths or credentials. */ }
      bridge.completeHomeAssistantCommand(request.id, ok);
    });
    return () => { clearInterval(timer); unsubscribe(); };
  }, []);
  useEffect(() => { desktopBridge()?.publishHomeAssistantState?.(homeAssistantSnapshot(p, ready)); }, [p, ready]);
  return null;
}
