import type { PlayerApi } from "@/components/winamp/player-context";

export type ControllerCommand = { id: string; command: string; value?: number | boolean | string };
export function controllerState(p: PlayerApi) {
  const queue = p.tracks.slice(0, 2000).map(t => t.title);
  return { state: p.paused && p.playing ? "paused" : p.playing ? "playing" : "idle", volume: p.volume, position: p.time, duration: p.duration, shuffle: p.shuffle, repeat: p.repeatMode, current: p.current < queue.length ? p.current : -1, queue };
}
export async function applyControllerCommand(p: PlayerApi, m: ControllerCommand) {
  switch (m.command) {
    case "play": if (!p.tracks.length) throw new Error("Queue is empty"); p.play(); break;
    case "pause": if (p.playing && !p.paused) p.pause(); break;
    case "stop": p.stop(); break;
    case "next": if (!p.tracks.length) throw new Error("Queue is empty"); p.next(); break;
    case "previous": if (!p.tracks.length) throw new Error("Queue is empty"); p.prev(); break;
    case "volume": if (typeof m.value !== "number" || !Number.isFinite(m.value) || m.value < 0 || m.value > 1) throw new Error("Invalid volume"); p.setVolume(m.value); break;
    case "seek": if (typeof m.value !== "number" || !Number.isFinite(m.value) || m.value < 0 || m.value > p.duration) throw new Error("Invalid position"); p.seek(m.value); break;
    case "shuffle": if (typeof m.value !== "boolean") throw new Error("Invalid shuffle"); if (p.shuffle !== m.value) p.toggleShuffle(); break;
    case "repeat": if (m.value !== "off" && m.value !== "all" && m.value !== "track") throw new Error("Invalid repeat"); p.setRepeatMode(m.value); break;
    case "track": if (typeof m.value !== "number" || !Number.isInteger(m.value) || !p.tracks[m.value]) throw new Error("Invalid track"); p.playAt(m.value); break;
    default: throw new Error("Unsupported command");
  }
}