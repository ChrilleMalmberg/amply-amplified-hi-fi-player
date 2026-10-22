import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { nextIndex, prevIndex, readTags } from "@/lib/winamp-logic";

export type Track = { id: number; file: File; url: string; title: string; duration: number };

export const AUDIO_EXT = /\.(mp3|flac|wav|wave|ogg|oga|opus|m4a|mp4|aac|aif|aiff|webm|weba|caf|alac|mka)$/i;
export const AUDIO_ACCEPT = "audio/*,.mp3,.flac,.wav,.ogg,.oga,.opus,.m4a,.aac,.aif,.aiff,.webm,.weba,.caf,.mka";

type Ctx = ReturnType<typeof usePlayerState>;
const PlayerCtx = createContext<Ctx | null>(null);
export const usePlayer = () => {
  const c = useContext(PlayerCtx);
  if (!c) throw new Error("no player");
  return c;
};

function usePlayerState() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pannerRef = useRef<StereoPannerNode | null>(null);
  const idRef = useRef(1);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [current, setCurrent] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [time, setTime] = useState(0);
  const [volume, setVolumeS] = useState(0.8);
  const [balance, setBalanceS] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [sampleRate, setSampleRate] = useState(44100);
  const [skipped, setSkipped] = useState<string[]>([]);
  const st = useRef({ tracks, current, shuffle, repeat });
  st.current = { tracks, current, shuffle, repeat };

  const ensureGraph = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!ctxRef.current) {
      // "playback" latency hint favours glitch-free, high quality output.
      const ctx = new AudioContext({ latencyHint: "playback" });
      const src = ctx.createMediaElementSource(a);
      const pan = ctx.createStereoPanner();
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      an.smoothingTimeConstant = 0.7;
      // Clean path: source -> panner (passthrough at 0) -> speakers. Analyser is a side tap only.
      src.connect(pan).connect(ctx.destination);
      pan.connect(an);
      ctxRef.current = ctx;
      analyserRef.current = an;
      pannerRef.current = pan;
      setSampleRate(ctx.sampleRate);
    }
    void ctxRef.current.resume();
  }, []);

  const playAt = useCallback(
    (i: number) => {
      const a = audioRef.current;
      const t = st.current.tracks[i];
      if (!a || !t) return;
      ensureGraph();
      setCurrent(i);
      if (a.src !== t.url) a.src = t.url;
      a.currentTime = 0;
      void a.play().catch(() => {});
    },
    [ensureGraph],
  );

  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    a.volume = 0.8;
    audioRef.current = a;
    const onTime = () => setTime(a.currentTime);
    const onPlay = () => {
      setPlaying(true);
      setPaused(false);
    };
    const onPause = () => setPaused(true);
    const onEnded = () => {
      const s = st.current;
      const n = nextIndex(s.current, s.tracks.length, s);
      if (n >= 0) playAt(n);
      else {
        setPlaying(false);
        setPaused(false);
      }
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    return () => {
      a.pause();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, [playAt]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const probe = audioRef.current;
    const list = Array.from(files).filter((f) => f.type.startsWith("audio/") || AUDIO_EXT.test(f.name));
    const bad: string[] = [];
    const added: Track[] = [];
    for (const f of list) {
      if (probe && f.type && probe.canPlayType(f.type) === "") {
        bad.push(f.name);
        continue;
      }
      const tags = await readTags(f).catch(() => ({}) as { title?: string; artist?: string });
      const base = f.name.replace(/\.[^.]+$/, "");
      const title = tags.title ? (tags.artist ? `${tags.artist} - ${tags.title}` : tags.title) : base;
      const t: Track = { id: idRef.current++, file: f, url: URL.createObjectURL(f), title, duration: 0 };
      added.push(t);
      const m = new Audio();
      m.preload = "metadata";
      m.onloadedmetadata = () =>
        setTracks((ts) => ts.map((x) => (x.id === t.id ? { ...x, duration: m.duration } : x)));
      m.onerror = () => setSkipped((s) => [...s, f.name]);
      m.src = t.url;
    }
    setSkipped(bad);
    setTracks((ts) => [...ts, ...added]);
  }, []);

  const a = () => audioRef.current;
  const api = {
    tracks,
    setTracks,
    current,
    playing,
    paused,
    time,
    volume,
    balance,
    shuffle,
    repeat,
    sampleRate,
    skipped,
    analyserRef,
    ensureGraph,
    addFiles,
    playAt,
    duration: tracks[current]?.duration ?? 0,
    play: () => {
      const el = a();
      if (!el) return;
      if (current < 0 || !el.src) {
        if (tracks.length) playAt(current < 0 ? 0 : current);
        return;
      }
      ensureGraph();
      if (!playing) el.currentTime = 0;
      void el.play();
    },
    pause: () => {
      const el = a();
      if (!el || !playing) return;
      if (el.paused) void el.play();
      else el.pause();
    },
    stop: () => {
      const el = a();
      if (!el) return;
      el.pause();
      el.currentTime = 0;
      setTime(0);
      setPlaying(false);
      setPaused(false);
    },
    next: () => {
      const n = nextIndex(current, tracks.length, { shuffle, repeat: true });
      if (n >= 0) playAt(n);
    },
    prev: () => {
      const n = prevIndex(current, tracks.length, { shuffle, repeat });
      if (n >= 0) playAt(n);
    },
    seek: (s: number) => {
      const el = a();
      if (el && isFinite(s)) el.currentTime = Math.max(0, s);
    },
    setVolume: (v: number) => {
      const c = Math.min(1, Math.max(0, v));
      setVolumeS(c);
      const el = a();
      if (el) el.volume = c;
    },
    setBalance: (b: number) => {
      setBalanceS(b);
      if (pannerRef.current) pannerRef.current.pan.value = b;
    },
    toggleShuffle: () => setShuffle((s) => !s),
    toggleRepeat: () => setRepeat((s) => !s),
  };
  return api;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const v = usePlayerState();
  return <PlayerCtx.Provider value={v}>{children}</PlayerCtx.Provider>;
}
