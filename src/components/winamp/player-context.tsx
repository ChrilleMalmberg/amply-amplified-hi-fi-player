import type React from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { nextIndex, prevIndex, readTags } from "@/lib/winamp-logic";
import { indexAfterEnd, nextRepeat, type RepeatMode } from "@/lib/winamp-features";
import { QUEUE_KEY, loadPlaylist, savePlaylist, type StoredItem } from "@/lib/playlist-store";
import { applyEqualizer, effectiveBalance, normalizeEqGain, type AudioCapabilities } from "@/lib/audio-plugins";

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
    if (s && Array.isArray(s.bands) && s.bands.length === 10) return { on: !!s.on, preamp: normalizeEqGain(Number(s.preamp)), bands: s.bands.map((v: unknown) => normalizeEqGain(Number(v))) };
  } catch { /* ignore */ }
  return EQ_DEFAULT;
}

/** Push EQ state into the live audio graph. OFF flattens every band (true bypass sound, no clicks). */
const applyEqToGraph = applyEqualizer;

export const AUDIO_EXT = /\.(mp3|mp2|mpga|flac|wav|wave|bwf|ogg|oga|opus|spx|m4a|m4b|mp4|aac|adts|aif|aiff|aifc|webm|weba|caf|alac|mka|wma|ape|wv|mpc|tta|dsf|dff|ac3|eac3|dts|amr|3gp|3ga|au|snd|mid|midi)$/i;
export const AUDIO_ACCEPT = "audio/*,.mp3,.mp2,.mpga,.flac,.wav,.bwf,.ogg,.oga,.opus,.spx,.m4a,.m4b,.mp4,.aac,.adts,.aif,.aiff,.aifc,.webm,.weba,.caf,.alac,.mka,.wma,.ape,.wv,.mpc,.tta,.dsf,.dff,.ac3,.eac3,.dts,.amr,.3gp,.3ga,.au,.snd,.mid,.midi";

type Ctx = ReturnType<typeof usePlayerState>;
export type PlayerApi = Ctx;
// Keep one context instance across hot reloads so provider and consumers always match.
const g = globalThis as unknown as { __llamampPlayerCtx?: React.Context<Ctx | null> };
const PlayerCtx = (g.__llamampPlayerCtx ??= createContext<Ctx | null>(null));
export const PlayerContext = PlayerCtx;
export const usePlayer = () => {
  const c = useContext(PlayerCtx);
  if (!c) throw new Error("no player");
  return c;
};

function usePlayerState() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const metadataRef = useRef(new Map<string, HTMLAudioElement>());
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pannerRef = useRef<StereoPannerNode | null>(null);
  const eqPreampRef = useRef<GainNode | null>(null);
  const eqBandsRef = useRef<BiquadFilterNode[]>([]);
  const [eq, setEq] = useState<EqState>(EQ_DEFAULT);
  const [eqPresetName, setEqPresetName] = useState<string | null>(null);
  const idRef = useRef(1);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [current, setCurrent] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [time, setTime] = useState(0);
  const [volume, setVolumeS] = useState(0.8);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const [balance, setBalanceS] = useState(0);
  const [balanceEnabled, setBalanceEnabledS] = useState(true);
  const balanceState = useRef({ enabled: balanceEnabled, value: balance });
  balanceState.current = { enabled: balanceEnabled, value: balance };
  const [audioCapabilities, setAudioCapabilities] = useState<AudioCapabilities>({ equalizer: false, balance: false });
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const repeat = repeatMode !== "off";
  const [stopAfter, setStopAfter] = useState(false);
  const [ab, setAbS] = useState<{ a: number | null; b: number | null }>({ a: null, b: null });
  const abRef = useRef(ab); abRef.current = ab;
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sampleRate, setSampleRate] = useState(44100);
  const [skipped, setSkipped] = useState<string[]>([]);
  const st = useRef({ tracks, current, shuffle, repeat, repeatMode, stopAfter });
  st.current = { tracks, current, shuffle, repeat, repeatMode, stopAfter };
  const queueRevision = useRef(0);

  const releaseMetadata = useCallback((url: string) => {
    const el = metadataRef.current.get(url);
    if (!el) return;
    el.onloadedmetadata = null;
    el.onerror = null;
    el.removeAttribute("src");
    el.load();
    metadataRef.current.delete(url);
  }, []);

  const cancelFade = useCallback(() => {
    if (fadeRef.current === null) return;
    clearInterval(fadeRef.current);
    fadeRef.current = null;
    if (audioRef.current) audioRef.current.volume = volumeRef.current;
  }, []);

  const resetPlayback = useCallback(
    (unload = false) => {
      cancelFade();
      const el = audioRef.current;
      if (el) {
        el.pause();
        if (unload) {
          el.removeAttribute("src");
          el.load();
        } else el.currentTime = 0;
      }
      setPlaying(false);
      setPaused(false);
      setTime(0);
      setAbS({ a: null, b: null });
    },
    [cancelFade],
  );

  /** All queue edits preserve the playing track by ID, including remote panel edits. */
  const updateTracks = useCallback(
    (update: React.SetStateAction<Track[]>) => {
      const old = st.current;
      const next = typeof update === "function" ? update(old.tracks) : update;
      const active = old.tracks[old.current];
      const current = active ? next.findIndex((t) => t.id === active.id) : -1;
      if (active && current < 0) resetPlayback(true);
      const retained = new Set(next.map((t) => t.url));
      old.tracks.forEach((t) => {
        if (!retained.has(t.url)) {
          releaseMetadata(t.url);
          URL.revokeObjectURL(t.url);
        }
      });
      // Update synchronously: several edits/commands can arrive before React renders.
      st.current = { ...old, tracks: next, current };
      queueRevision.current += 1;
      setTracks(next);
      setCurrent(current);
    },
    [releaseMetadata, resetPlayback],
  );

  const ensureGraph = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!ctxRef.current) {
      // "playback" latency hint favours glitch-free, high quality output.
      const ctx = new AudioContext({ latencyHint: "playback" });
      const src = ctx.createMediaElementSource(a);
      const pan = ctx.createStereoPanner();
      pan.pan.value = effectiveBalance(balanceState.current.enabled, balanceState.current.value);
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      an.smoothingTimeConstant = 0.7;
      // Path: source -> EQ (preamp + 10 peaking bands) -> panner -> speakers.
      // Analyser stays a side tap only, so visuals never alter sound quality.
      const pre = ctx.createGain();
      const bands = EQ_FREQS.map((f) => {
        const bq = ctx.createBiquadFilter();
        bq.type = f === EQ_FREQS[0] ? "lowshelf" : f === EQ_FREQS[EQ_FREQS.length - 1] ? "highshelf" : "peaking";
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
      cancelFade();
      ensureGraph();
      setAbS({ a: null, b: null });
      st.current = { ...st.current, current: i };
      setCurrent(i);
      setTime(0);
      if (a.src !== t.url) a.src = t.url;
      a.currentTime = 0;
      void a.play().catch(() => {});
    },
    [cancelFade, ensureGraph],
  );

  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    a.volume = 0.8;
    audioRef.current = a;
    const metadata = metadataRef.current;
    const onTime = () => {
      const { a: A, b: B } = abRef.current;
      if (A !== null && B !== null && a.currentTime >= B) a.currentTime = A;
      setTime(a.currentTime);
    };
    const onPlay = () => {
      setPlaying(true);
      setPaused(false);
    };
    const onPause = () => setPaused(true);
    const onEnded = () => {
      const s = st.current;
      const n = indexAfterEnd(s.current, s.tracks.length, { shuffle: s.shuffle, repeat: s.repeatMode, stopAfter: s.stopAfter });
      if (s.stopAfter) setStopAfter(false);
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
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      cancelFade();
      a.pause();
      a.removeAttribute("src");
      a.load();
      audioRef.current = null;
      for (const url of metadata.keys()) releaseMetadata(url);
      st.current.tracks.forEach(t => URL.revokeObjectURL(t.url));
      void ctxRef.current?.close();
      ctxRef.current = null;
      analyserRef.current = null;
      pannerRef.current = null;
      eqPreampRef.current = null;
      eqBandsRef.current = [];
    };
  }, [cancelFade, playAt, releaseMetadata]);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const probe = audioRef.current;
      const list = Array.from(files).filter(
        (f) => f.type.startsWith("audio/") || AUDIO_EXT.test(f.name),
      );
      const bad: string[] = [];
      const added: Track[] = [];
      for (const f of list) {
        if (probe && f.type && probe.canPlayType(f.type) === "") {
          bad.push(f.name);
          continue;
        }
        const tags = await readTags(f).catch(() => ({}) as { title?: string; artist?: string });
        if (audioRef.current !== probe) {
          added.forEach((t) => URL.revokeObjectURL(t.url));
          return;
        }
        const base = f.name.replace(/\.[^.]+$/, "");
        const title = tags.title
          ? tags.artist
            ? `${tags.artist} - ${tags.title}`
            : tags.title
          : base;
        const t: Track = {
          id: idRef.current++,
          file: f,
          url: URL.createObjectURL(f),
          title,
          duration: 0,
        };
        added.push(t);
      }
      setSkipped(bad);
      if (!added.length) return;
      updateTracks((ts) => [...ts, ...added]);
      // Commit every row before probing: metadata for early files may arrive while
      // readTags is still awaiting later files in a large import.
      for (const t of added) {
        const m = new Audio();
        metadataRef.current.set(t.url, m);
        m.preload = "metadata";
        m.onloadedmetadata = () => {
          const duration = Number.isFinite(m.duration) ? m.duration : 0;
          updateTracks((ts) => ts.map((x) => (x.id === t.id ? { ...x, duration } : x)));
          releaseMetadata(t.url);
        };
        m.onerror = () => {
          setSkipped((s) => [...s, t.file.name]);
          releaseMetadata(t.url);
        };
        m.src = t.url;
      }
    },
    [releaseMetadata, updateTracks],
  );

  /** Replace the queue with stored items (keeps original file bytes). */
  const loadItems = useCallback(
    (items: StoredItem[]) => {
      resetPlayback(true);
      st.current = { ...st.current, current: -1 };
      updateTracks(
        items.map((it) => ({
          id: idRef.current++,
          file: it.file,
          url: URL.createObjectURL(it.file),
          title: it.title,
          duration: it.duration,
        })),
      );
    },
    [resetPlayback, updateTracks],
  );

  const toItems = useCallback(
    (ts: Track[]): StoredItem[] => ts.map((t) => ({ file: t.file, title: t.title, duration: t.duration })),
    [],
  );

  // Restore the last queue on first load, then keep it saved automatically.
  const [restoreStatus, setRestoreStatus] = useState<"pending" | "loaded" | "failed">("pending");
  useEffect(() => {
    let active = true;
    const revision = queueRevision.current;
    loadPlaylist(QUEUE_KEY)
      .then((p) => {
        // Never replace music the user added while IndexedDB was still opening.
        if (active && queueRevision.current === revision && p?.items.length) loadItems(p.items);
        if (active) setRestoreStatus("loaded");
      })
      .catch(() => {
        if (active) setRestoreStatus("failed");
      });
    return () => {
      active = false;
    };
  }, [loadItems]);
  useEffect(() => {
    if (restoreStatus === "pending") return;
    // A failed read must not overwrite an existing queue with the initial empty state.
    if (restoreStatus === "failed" && queueRevision.current === 0) return;
    const h = setTimeout(() => {
      void savePlaylist({ name: QUEUE_KEY, items: toItems(tracks), savedAt: Date.now() }).catch(
        () => {},
      );
    }, 800);
    return () => clearTimeout(h);
  }, [restoreStatus, tracks, toItems]);

  const updateEq = useCallback((next: EqState) => {
    const normalized = { ...next, preamp: normalizeEqGain(next.preamp), bands: next.bands.map(normalizeEqGain) };
    setEq(normalized);
    try {
      localStorage.setItem(EQ_KEY, JSON.stringify(normalized));
    } catch { /* ignore */ }
    if (eqPreampRef.current) applyEqToGraph(eqPreampRef.current, eqBandsRef.current, normalized);
  }, []);

  useEffect(() => { updateEq(loadEq()); }, [updateEq]);

  const saveBalance = (enabled: boolean, value: number) => {
    const normalized = Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
    setBalanceS(normalized);
    setBalanceEnabledS(enabled);
    balanceState.current = { enabled, value: normalized };
    if (pannerRef.current) pannerRef.current.pan.value = effectiveBalance(enabled, normalized);
    try { localStorage.setItem("amply-balance", JSON.stringify({ enabled, value: normalized })); } catch { /* storage unavailable */ }
  };
  useEffect(() => {
    const proto = typeof AudioContext !== "undefined" ? AudioContext.prototype : undefined;
    setAudioCapabilities({ equalizer: typeof proto?.createBiquadFilter === "function", balance: typeof proto?.createStereoPanner === "function" });
    try {
      const saved = JSON.parse(localStorage.getItem("amply-balance") || "null");
      if (saved && typeof saved.enabled === "boolean" && typeof saved.value === "number") saveBalance(saved.enabled, saved.value);
    } catch { /* keep defaults */ }
  }, []);

  const tracksFromItems = (items: StoredItem[]): Track[] => items.map(item => ({
    id: idRef.current++, file: item.file, url: URL.createObjectURL(item.file),
    title: item.artist && item.artist !== "Unknown artist" ? `${item.artist} - ${item.title}` : item.title,
    duration: item.duration,
  }));
  const appendItems = (items: StoredItem[]) => {
    const added = tracksFromItems(items);
    updateTracks(old => [...old, ...added]);
  };
  const playItems = (items: StoredItem[]) => {
    if (!items.length) return;
    const added = tracksFromItems(items);
    updateTracks(added);
    playAt(0);
  };

  const a = () => audioRef.current;
  const api = {
    tracks,
    setTracks: updateTracks,
    current,
    playing,
    paused,
    time,
    volume,
    balance,
    balanceEnabled,
    audioCapabilities,
    shuffle,
    repeat,
    sampleRate,
    skipped,
    analyserRef,
    ensureGraph,
    addFiles,
    playAt,
    loadItems,
    appendItems,
    playItems,
    saveAs: (name: string) => savePlaylist({ name, items: toItems(tracks), savedAt: Date.now() }),
    duration: tracks[current]?.duration ?? 0,
    play: () => {
      const el = a();
      if (!el) return;
      cancelFade();
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
      cancelFade();
      if (el.paused) void el.play();
      else el.pause();
    },
    stop: () => resetPlayback(),
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
      cancelFade();
      const c = Math.min(1, Math.max(0, v));
      setVolumeS(c);
      const el = a();
      if (el) el.volume = c;
    },
    setBalance: (b: number) => {
      saveBalance(balanceEnabled, b);
    },
    setBalanceEnabled: (enabled: boolean) => saveBalance(enabled, balance),
    toggleShuffle: () => setShuffle((s) => !s),
    toggleRepeat: () => setRepeatMode((m) => nextRepeat(m)),
    repeatMode,
    setRepeatMode,
    stopAfter,
    toggleStopAfter: () => setStopAfter((v) => !v),
    ab,
    /** Winamp-style A-B loop: first press sets A, second sets B, third clears. */
    cycleAB: () => {
      const el = a(); if (!el) return;
      setAbS((s) => s.a === null ? { a: el.currentTime, b: null } : s.b === null && el.currentTime > s.a + 0.5 ? { a: s.a, b: el.currentTime } : { a: null, b: null });
    },
    /** Fade the output volume out over ~1.5 s, then stop and restore the volume setting. */
    fadeStop: () => {
      const el = a(); if (!el || el.paused) { api.stop(); return; }
      if (fadeRef.current) return;
      const start = el.volume; let step = 0;
      fadeRef.current = setInterval(() => {
        step += 1; el.volume = Math.max(0, start * (1 - step / 30));
        if (step >= 30) { clearInterval(fadeRef.current!); fadeRef.current = null; el.pause(); el.currentTime = 0; el.volume = start; setTime(0); setPlaying(false); setPaused(false); }
      }, 50);
    },
    seekBy: (d: number) => { const el = a(); if (el && el.src) el.currentTime = Math.max(0, Math.min((el.duration || 0) - 0.05, el.currentTime + d)); },
    volumeBy: (d: number) => { cancelFade(); const el = a(); const c = Math.min(1, Math.max(0, (el?.volume ?? volume) + d)); setVolumeS(c); if (el) el.volume = c; },
    eq,
    eqPresetName,
    setEqOn: (on: boolean) => updateEq({ ...eq, on }),
    resetEq: () => { setEqPresetName("Flat"); updateEq({ ...eq, preamp: 0, bands: Array(10).fill(0) }); },
    setEqBand: (i: number, v: number) => {
      setEqPresetName(null);
      updateEq({ ...eq, on: true, bands: eq.bands.map((b, k) => (k === i ? v : b)) });
    },
    setEqPreamp: (v: number) => {
      setEqPresetName(null);
      updateEq({ ...eq, on: true, preamp: v });
    },
    applyEqPreset: (name: string) => {
      const pr = EQ_PRESETS[name];
      if (pr) {
        setEqPresetName(name);
        updateEq({ on: true, preamp: pr.preamp, bands: [...pr.bands] });
      }
    },
  };
  return api;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const v = usePlayerState();
  return <PlayerCtx.Provider value={v}>{children}</PlayerCtx.Provider>;
}
