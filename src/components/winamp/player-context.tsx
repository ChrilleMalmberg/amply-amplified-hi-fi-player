import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { nextIndex, prevIndex, readTags } from "@/lib/winamp-logic";
import { QUEUE_KEY, loadPlaylist, savePlaylist, type StoredItem } from "@/lib/playlist-store";

export type Track = { id: number; file: File; url: string; title: string; duration: number };

/** Winamp 2.x equalizer bands (Hz). */
export const EQ_FREQS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
export const EQ_LABELS = ["60", "170", "310", "600", "1K", "3K", "6K", "12K", "14K", "16K"];
export const EQ_PRESETS: Record<string, { preamp: number; bands: number[] }> = {
  Flat: { preamp: 0, bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  Rock: { preamp: 0, bands: [5, 3.5, -5.5, -8, -3, 4, 9, 11, 11, 10] },
  Pop: { preamp: 0, bands: [-1, 3, 7, 7, 5, 0, -2, -2, -1, -1] },
  Jazz: { preamp: 0, bands: [4, 3, 1, 2, -2, -2, 0, 2, 3, 4] },
  Classical: { preamp: 0, bands: [5, 3, 0, 0, 0, 0, -4, -4, 0, 6] },
  "Bass boost": { preamp: 0, bands: [9, 7, 5, 2, 0, 0, 0, 0, 0, 0] },
  "Treble boost": { preamp: 0, bands: [0, 0, 0, 0, 0, 2, 5, 8, 9, 10] },
  Vocal: { preamp: 0, bands: [-2, -4, -4, 1, 4, 6, 5, 3, 1, 0] },
};
const EQ_KEY = "llamamp-eq";
type EqState = { on: boolean; preamp: number; bands: number[] };
const EQ_DEFAULT: EqState = { on: false, preamp: 0, bands: new Array(10).fill(0) };
function loadEq(): EqState {
  try {
    const s = JSON.parse(localStorage.getItem(EQ_KEY) || "null");
    if (s && Array.isArray(s.bands) && s.bands.length === 10) return { on: !!s.on, preamp: +s.preamp || 0, bands: s.bands.map((v: unknown) => +v || 0) };
  } catch { /* ignore */ }
  return EQ_DEFAULT;
}

/** Push EQ state into the live audio graph. OFF flattens every band (true bypass sound, no clicks). */
function applyEqToGraph(pre: GainNode, bands: BiquadFilterNode[], eq: EqState) {
  pre.gain.value = eq.on ? Math.pow(10, eq.preamp / 20) : 1;
  bands.forEach((bq, i) => (bq.gain.value = eq.on ? eq.bands[i] : 0));
}

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
  const eqPreampRef = useRef<GainNode | null>(null);
  const eqBandsRef = useRef<BiquadFilterNode[]>([]);
  const [eq, setEq] = useState<EqState>(loadEq);
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
      // Path: source -> EQ (preamp + 10 peaking bands) -> panner -> speakers.
      // Analyser stays a side tap only, so visuals never alter sound quality.
      const pre = ctx.createGain();
      const bands = EQ_FREQS.map((f) => {
        const bq = ctx.createBiquadFilter();
        bq.type = "peaking";
        bq.frequency.value = f;
        bq.Q.value = 1.1; // musical, low-phase-smear curve
        return bq;
      });
      src.connect(pre);
      bands.reduce((prev, bq) => (prev.connect(bq), bq), pre as AudioNode).connect(pan).connect(ctx.destination);
      pan.connect(an);
      ctxRef.current = ctx;
      analyserRef.current = an;
      pannerRef.current = pan;
      eqPreampRef.current = pre;
      eqBandsRef.current = bands;
      applyEqToGraph(pre, bands, loadEq());
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

  /** Replace the queue with stored items (keeps original file bytes). */
  const loadItems = useCallback((items: StoredItem[]) => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
    }
    setPlaying(false);
    setPaused(false);
    setTime(0);
    setCurrent(-1);
    setTracks((old) => {
      old.forEach((t) => URL.revokeObjectURL(t.url));
      return items.map((it) => ({
        id: idRef.current++,
        file: it.file,
        url: URL.createObjectURL(it.file),
        title: it.title,
        duration: it.duration,
      }));
    });
  }, []);

  const toItems = useCallback(
    (ts: Track[]): StoredItem[] => ts.map((t) => ({ file: t.file, title: t.title, duration: t.duration })),
    [],
  );

  // Restore the last queue on first load, then keep it saved automatically.
  const restored = useRef(false);
  useEffect(() => {
    loadPlaylist(QUEUE_KEY)
      .then((p) => p && p.items.length && loadItems(p.items))
      .catch(() => {})
      .finally(() => (restored.current = true));
  }, [loadItems]);
  useEffect(() => {
    if (!restored.current) return;
    const h = setTimeout(() => {
      void savePlaylist({ name: QUEUE_KEY, items: toItems(tracks), savedAt: Date.now() }).catch(() => {});
    }, 800);
    return () => clearTimeout(h);
  }, [tracks, toItems]);

  const updateEq = useCallback((next: EqState) => {
    setEq(next);
    try {
      localStorage.setItem(EQ_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
    if (eqPreampRef.current) applyEqToGraph(eqPreampRef.current, eqBandsRef.current, next);
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
    loadItems,
    saveAs: (name: string) => savePlaylist({ name, items: toItems(tracks), savedAt: Date.now() }),
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
    eq,
    setEqOn: (on: boolean) => updateEq({ ...eq, on }),
    setEqBand: (i: number, v: number) => updateEq({ ...eq, bands: eq.bands.map((b, k) => (k === i ? v : b)) }),
    setEqPreamp: (v: number) => updateEq({ ...eq, preamp: v }),
    applyEqPreset: (name: string) => {
      const pr = EQ_PRESETS[name];
      if (pr) updateEq({ on: true, preamp: pr.preamp, bands: [...pr.bands] });
    },
  };
  return api;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const v = usePlayerState();
  return <PlayerCtx.Provider value={v}>{children}</PlayerCtx.Provider>;
}
