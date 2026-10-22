import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/lib/winamp-logic.ts
/** Snap a window rect to screen edges and to other windows' edges within `t` pixels. */
function snap(r, others, vw, vh, t = 10) {
	const xs = [0, vw - r.w];
	const ys = [0, vh - r.h];
	for (const o of others) {
		xs.push(o.x, o.x + o.w, o.x - r.w, o.x + o.w - r.w);
		ys.push(o.y, o.y + o.h, o.y - r.h, o.y + o.h - r.h);
	}
	const pick = (v, cands) => {
		let best = v;
		let d = t + 1;
		for (const c of cands) {
			const dd = Math.abs(c - v);
			if (dd <= t && dd < d) {
				d = dd;
				best = c;
			}
		}
		return best;
	};
	return {
		x: pick(r.x, xs),
		y: pick(r.y, ys)
	};
}
/** Next track index, or -1 when playback should stop. */
function nextIndex(cur, len, mode, rand = Math.random) {
	if (len === 0) return -1;
	if (mode.shuffle) {
		if (len === 1) return mode.repeat ? 0 : -1;
		let n = Math.floor(rand() * (len - 1));
		if (n >= cur) n += 1;
		return n;
	}
	if (cur + 1 < len) return cur + 1;
	return mode.repeat ? 0 : -1;
}
function prevIndex(cur, len, mode) {
	if (len === 0) return -1;
	if (cur > 0) return cur - 1;
	return mode.repeat ? len - 1 : 0;
}
function fmtTime(s) {
	if (!isFinite(s) || s < 0) s = 0;
	return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}
function decodeText(data) {
	const enc = data[0];
	let body = data.slice(1);
	let label = "latin1";
	if (enc === 3) label = "utf-8";
	else if (enc === 2) label = "utf-16be";
	else if (enc === 1) {
		if (body[0] === 254 && body[1] === 255) label = "utf-16be";
		else label = "utf-16le";
		body = body.slice(2);
	}
	try {
		return new TextDecoder(label).decode(body).replace(/\0/g, "").trim();
	} catch {
		return "";
	}
}
/** Minimal ID3v2.3/2.4 reader for title + artist. */
async function readTags(file) {
	const buf = new Uint8Array(await file.slice(0, 262144).arrayBuffer());
	if (buf[0] !== 73 || buf[1] !== 68 || buf[2] !== 51) return {};
	const ver = buf[3];
	const ss = (i) => (buf[i] & 127) << 21 | (buf[i + 1] & 127) << 14 | (buf[i + 2] & 127) << 7 | buf[i + 3] & 127;
	const end = Math.min(10 + ss(6), buf.length);
	let p = 10;
	const out = {};
	while (p + 10 < end) {
		const id = String.fromCharCode(buf[p], buf[p + 1], buf[p + 2], buf[p + 3]);
		if (!/^[A-Z0-9]{4}$/.test(id)) break;
		const fs = ver === 4 ? ss(p + 4) : (buf[p + 4] << 24 | buf[p + 5] << 16 | buf[p + 6] << 8 | buf[p + 7]) >>> 0;
		const data = buf.slice(p + 10, p + 10 + fs);
		if (id === "TIT2") out.title = decodeText(data);
		if (id === "TPE1") out.artist = decodeText(data);
		p += 10 + fs;
	}
	return out;
}
//#endregion
//#region src/lib/playlist-store.ts
var QUEUE_KEY = "__queue__";
var DB = "llamamp";
var STORE = "playlists";
function open() {
	return new Promise((res, rej) => {
		const r = indexedDB.open(DB, 1);
		r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "name" });
		r.onsuccess = () => res(r.result);
		r.onerror = () => rej(r.error);
	});
}
async function tx(mode, fn) {
	const db = await open();
	return new Promise((res, rej) => {
		const t = db.transaction(STORE, mode);
		const req = fn(t.objectStore(STORE));
		t.oncomplete = () => {
			db.close();
			res(req.result);
		};
		t.onerror = () => rej(t.error);
	});
}
var savePlaylist = (p) => tx("readwrite", (s) => s.put(p));
var loadPlaylist = (name) => tx("readonly", (s) => s.get(name));
var deletePlaylist = (name) => tx("readwrite", (s) => s.delete(name));
async function listPlaylists() {
	return (await tx("readonly", (s) => s.getAll())).filter((p) => p.name !== QUEUE_KEY).map((p) => ({
		name: p.name,
		count: p.items.length,
		savedAt: p.savedAt
	})).sort((a, b) => b.savedAt - a.savedAt);
}
//#endregion
//#region src/components/winamp/player-context.tsx
var AUDIO_EXT = /\.(mp3|flac|wav|wave|ogg|oga|opus|m4a|mp4|aac|aif|aiff|webm|weba|caf|alac|mka)$/i;
var AUDIO_ACCEPT = "audio/*,.mp3,.flac,.wav,.ogg,.oga,.opus,.m4a,.aac,.aif,.aiff,.webm,.weba,.caf,.mka";
var PlayerCtx = createContext(null);
var usePlayer = () => {
	const c = useContext(PlayerCtx);
	if (!c) throw new Error("no player");
	return c;
};
function usePlayerState() {
	const audioRef = useRef(null);
	const ctxRef = useRef(null);
	const analyserRef = useRef(null);
	const pannerRef = useRef(null);
	const idRef = useRef(1);
	const [tracks, setTracks] = useState([]);
	const [current, setCurrent] = useState(-1);
	const [playing, setPlaying] = useState(false);
	const [paused, setPaused] = useState(false);
	const [time, setTime] = useState(0);
	const [volume, setVolumeS] = useState(.8);
	const [balance, setBalanceS] = useState(0);
	const [shuffle, setShuffle] = useState(false);
	const [repeat, setRepeat] = useState(false);
	const [sampleRate, setSampleRate] = useState(44100);
	const [skipped, setSkipped] = useState([]);
	const st = useRef({
		tracks,
		current,
		shuffle,
		repeat
	});
	st.current = {
		tracks,
		current,
		shuffle,
		repeat
	};
	const ensureGraph = useCallback(() => {
		const a = audioRef.current;
		if (!a) return;
		if (!ctxRef.current) {
			const ctx = new AudioContext({ latencyHint: "playback" });
			const src = ctx.createMediaElementSource(a);
			const pan = ctx.createStereoPanner();
			const an = ctx.createAnalyser();
			an.fftSize = 2048;
			an.smoothingTimeConstant = .7;
			src.connect(pan).connect(ctx.destination);
			pan.connect(an);
			ctxRef.current = ctx;
			analyserRef.current = an;
			pannerRef.current = pan;
			setSampleRate(ctx.sampleRate);
		}
		ctxRef.current.resume();
	}, []);
	const playAt = useCallback((i) => {
		const a = audioRef.current;
		const t = st.current.tracks[i];
		if (!a || !t) return;
		ensureGraph();
		setCurrent(i);
		if (a.src !== t.url) a.src = t.url;
		a.currentTime = 0;
		a.play().catch(() => {});
	}, [ensureGraph]);
	useEffect(() => {
		const a = new Audio();
		a.preload = "auto";
		a.volume = .8;
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
	const addFiles = useCallback(async (files) => {
		const probe = audioRef.current;
		const list = Array.from(files).filter((f) => f.type.startsWith("audio/") || AUDIO_EXT.test(f.name));
		const bad = [];
		const added = [];
		for (const f of list) {
			if (probe && f.type && probe.canPlayType(f.type) === "") {
				bad.push(f.name);
				continue;
			}
			const tags = await readTags(f).catch(() => ({}));
			const base = f.name.replace(/\.[^.]+$/, "");
			const title = tags.title ? tags.artist ? `${tags.artist} - ${tags.title}` : tags.title : base;
			const t = {
				id: idRef.current++,
				file: f,
				url: URL.createObjectURL(f),
				title,
				duration: 0
			};
			added.push(t);
			const m = new Audio();
			m.preload = "metadata";
			m.onloadedmetadata = () => setTracks((ts) => ts.map((x) => x.id === t.id ? {
				...x,
				duration: m.duration
			} : x));
			m.onerror = () => setSkipped((s) => [...s, f.name]);
			m.src = t.url;
		}
		setSkipped(bad);
		setTracks((ts) => [...ts, ...added]);
	}, []);
	/** Replace the queue with stored items (keeps original file bytes). */
	const loadItems = useCallback((items) => {
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
				duration: it.duration
			}));
		});
	}, []);
	const toItems = useCallback((ts) => ts.map((t) => ({
		file: t.file,
		title: t.title,
		duration: t.duration
	})), []);
	const restored = useRef(false);
	useEffect(() => {
		loadPlaylist(QUEUE_KEY).then((p) => p && p.items.length && loadItems(p.items)).catch(() => {}).finally(() => restored.current = true);
	}, [loadItems]);
	useEffect(() => {
		if (!restored.current) return;
		const h = setTimeout(() => {
			savePlaylist({
				name: QUEUE_KEY,
				items: toItems(tracks),
				savedAt: Date.now()
			}).catch(() => {});
		}, 800);
		return () => clearTimeout(h);
	}, [tracks, toItems]);
	const a = () => audioRef.current;
	return {
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
		saveAs: (name) => savePlaylist({
			name,
			items: toItems(tracks),
			savedAt: Date.now()
		}),
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
			el.play();
		},
		pause: () => {
			const el = a();
			if (!el || !playing) return;
			if (el.paused) el.play();
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
			const n = nextIndex(current, tracks.length, {
				shuffle,
				repeat: true
			});
			if (n >= 0) playAt(n);
		},
		prev: () => {
			const n = prevIndex(current, tracks.length, {
				shuffle,
				repeat
			});
			if (n >= 0) playAt(n);
		},
		seek: (s) => {
			const el = a();
			if (el && isFinite(s)) el.currentTime = Math.max(0, s);
		},
		setVolume: (v) => {
			const c = Math.min(1, Math.max(0, v));
			setVolumeS(c);
			const el = a();
			if (el) el.volume = c;
		},
		setBalance: (b) => {
			setBalanceS(b);
			if (pannerRef.current) pannerRef.current.pan.value = b;
		},
		toggleShuffle: () => setShuffle((s) => !s),
		toggleRepeat: () => setRepeat((s) => !s)
	};
}
function PlayerProvider({ children }) {
	const v = usePlayerState();
	return /* @__PURE__ */ jsx(PlayerCtx.Provider, {
		value: v,
		children
	});
}
//#endregion
//#region src/components/winamp/WaWindow.tsx
function WaWindow({ id, title, pos, onMove, onClose, width, children, onContextMenu }) {
	const ref = useRef(null);
	const [shaded, setShaded] = useState(false);
	const onDown = (e) => {
		if (e.target.closest("button")) return;
		const el = ref.current;
		if (!el) return;
		const ox = e.clientX - pos.x;
		const oy = e.clientY - pos.y;
		const others = Array.from(document.querySelectorAll("[data-wa-win]")).filter((n) => n.dataset.waWin !== id).map((n) => {
			const r = n.getBoundingClientRect();
			return {
				x: r.left,
				y: r.top,
				w: r.width,
				h: r.height
			};
		});
		const move = (ev) => {
			const r = el.getBoundingClientRect();
			onMove(snap({
				x: ev.clientX - ox,
				y: ev.clientY - oy,
				w: r.width,
				h: r.height
			}, others, window.innerWidth, window.innerHeight));
		};
		const up = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	};
	return /* @__PURE__ */ jsxs("div", {
		ref,
		"data-wa-win": id,
		className: "wa-window",
		style: {
			left: pos.x,
			top: pos.y,
			width
		},
		onContextMenu,
		children: [/* @__PURE__ */ jsxs("div", {
			className: "wa-titlebar",
			onPointerDown: onDown,
			onDoubleClick: () => setShaded((s) => !s),
			children: [
				/* @__PURE__ */ jsx("span", { className: "wa-title-stripes" }),
				/* @__PURE__ */ jsx("span", {
					className: "wa-title-text",
					children: title
				}),
				/* @__PURE__ */ jsx("span", { className: "wa-title-stripes" }),
				/* @__PURE__ */ jsx("button", {
					className: "wa-tbtn",
					"aria-label": "Shade",
					onClick: () => setShaded((s) => !s),
					children: "_"
				}),
				onClose && /* @__PURE__ */ jsx("button", {
					className: "wa-tbtn",
					"aria-label": "Close",
					onClick: onClose,
					children: "×"
				})
			]
		}), !shaded && children]
	});
}
//#endregion
//#region src/components/winamp/MainWindow.tsx
function cssVar(el, n) {
	return getComputedStyle(el).getPropertyValue(n).trim();
}
function Spectrum() {
	const p = usePlayer();
	const ref = useRef(null);
	const [scope, setScope] = useState(false);
	useEffect(() => {
		const c = ref.current;
		const g = c.getContext("2d");
		const peaks = new Array(19).fill(0);
		let raf = 0;
		const draw = () => {
			raf = requestAnimationFrame(draw);
			const an = p.analyserRef.current;
			const lo = cssVar(c, "--wa-lcd-text");
			const hi = cssVar(c, "--wa-spec-hi");
			g.clearRect(0, 0, c.width, c.height);
			if (!an) return;
			if (scope) {
				const d = new Uint8Array(an.fftSize);
				an.getByteTimeDomainData(d);
				g.strokeStyle = lo;
				g.lineWidth = 2;
				g.beginPath();
				for (let x = 0; x < c.width; x++) {
					const y = d[Math.floor(x / c.width * d.length)] / 255 * c.height;
					if (x) g.lineTo(x, y);
					else g.moveTo(x, y);
				}
				g.stroke();
				return;
			}
			const d = new Uint8Array(an.frequencyBinCount);
			an.getByteFrequencyData(d);
			const bw = c.width / 19;
			const grad = g.createLinearGradient(0, c.height, 0, 0);
			grad.addColorStop(0, lo);
			grad.addColorStop(1, hi);
			for (let i = 0; i < 19; i++) {
				const a = Math.floor(Math.pow(i / 19, 2) * 300) + 1;
				const b = Math.floor(Math.pow((i + 1) / 19, 2) * 300) + 2;
				let m = 0;
				for (let k = a; k < b; k++) m = Math.max(m, d[k]);
				const h = Math.round(m / 255 * c.height / 2) * 2;
				peaks[i] = Math.max(peaks[i] - .6, h);
				g.fillStyle = grad;
				g.fillRect(i * bw, c.height - h, bw - 2, h);
				g.fillStyle = hi;
				g.fillRect(i * bw, c.height - peaks[i] - 2, bw - 2, 2);
			}
		};
		draw();
		return () => cancelAnimationFrame(raf);
	}, [p.analyserRef, scope]);
	return /* @__PURE__ */ jsx("canvas", {
		ref,
		width: 152,
		height: 32,
		className: "wa-spectrum",
		onClick: () => setScope((s) => !s),
		title: "Click: spectrum / oscilloscope"
	});
}
function MainWindow({ onTogglePL, onToggleVis }) {
	const p = usePlayer();
	const fileRef = useRef(null);
	const t = p.tracks[p.current];
	const kbps = t && t.duration ? Math.round(t.file.size * 8 / t.duration / 1e3) : 0;
	const title = t ? `${p.current + 1}. ${t.title} (${fmtTime(t.duration)})  ***  ` : "WINAMP 2.0  ***  IT REALLY WHIPS THE LLAMA'S ASS  ***  ";
	const [remaining, setRemaining] = useState(false);
	const shown = remaining ? p.duration - p.time : p.time;
	return /* @__PURE__ */ jsxs("div", {
		className: "wa-main",
		children: [
			/* @__PURE__ */ jsx("input", {
				ref: fileRef,
				type: "file",
				multiple: true,
				accept: AUDIO_ACCEPT,
				hidden: true,
				onChange: (e) => e.target.files && p.addFiles(e.target.files)
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "wa-row",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "wa-lcd wa-display",
					children: [
						/* @__PURE__ */ jsx("div", {
							className: "wa-status",
							children: p.playing ? p.paused ? "❚❚" : "▶" : "■"
						}),
						/* @__PURE__ */ jsxs("button", {
							className: `wa-time ${p.paused ? "wa-blink" : ""}`,
							onClick: () => setRemaining((r) => !r),
							children: [remaining ? "-" : " ", fmtTime(shown)]
						}),
						/* @__PURE__ */ jsx(Spectrum, {})
					]
				}), /* @__PURE__ */ jsxs("div", {
					className: "wa-info",
					children: [
						/* @__PURE__ */ jsx("div", {
							className: "wa-lcd wa-marquee",
							children: /* @__PURE__ */ jsxs("span", {
								className: "wa-marquee-inner",
								children: [title, title]
							})
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "wa-meta",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "wa-lcd wa-small",
									children: kbps || "--"
								}),
								/* @__PURE__ */ jsx("span", {
									className: "wa-label",
									children: "kbps"
								}),
								/* @__PURE__ */ jsx("span", {
									className: "wa-lcd wa-small",
									children: Math.round(p.sampleRate / 1e3)
								}),
								/* @__PURE__ */ jsx("span", {
									className: "wa-label",
									children: "kHz"
								}),
								/* @__PURE__ */ jsx("span", {
									className: `wa-label ${t ? "wa-on" : ""}`,
									children: "stereo"
								})
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "wa-sliders",
							children: [
								/* @__PURE__ */ jsx("input", {
									"aria-label": "Volume",
									className: "wa-range",
									type: "range",
									min: 0,
									max: 1,
									step: .01,
									value: p.volume,
									onChange: (e) => p.setVolume(+e.target.value)
								}),
								/* @__PURE__ */ jsx("input", {
									"aria-label": "Balance",
									className: "wa-range wa-balance",
									type: "range",
									min: -1,
									max: 1,
									step: .02,
									value: p.balance,
									onChange: (e) => p.setBalance(+e.target.value),
									onDoubleClick: () => p.setBalance(0)
								}),
								/* @__PURE__ */ jsx("button", {
									className: "wa-toggle",
									onClick: onToggleVis,
									children: "VIS"
								}),
								/* @__PURE__ */ jsx("button", {
									className: "wa-toggle",
									onClick: onTogglePL,
									children: "PL"
								})
							]
						})
					]
				})]
			}),
			/* @__PURE__ */ jsx("input", {
				"aria-label": "Seek",
				className: "wa-range wa-seek",
				type: "range",
				min: 0,
				max: p.duration || 1,
				step: .1,
				value: Math.min(p.time, p.duration || 0),
				onChange: (e) => p.seek(+e.target.value),
				disabled: !t
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "wa-controls",
				children: [
					/* @__PURE__ */ jsx("button", {
						className: "wa-btn",
						"aria-label": "Previous",
						onClick: p.prev,
						children: "⏮"
					}),
					/* @__PURE__ */ jsx("button", {
						className: "wa-btn",
						"aria-label": "Play",
						onClick: p.play,
						children: "▶"
					}),
					/* @__PURE__ */ jsx("button", {
						className: "wa-btn",
						"aria-label": "Pause",
						onClick: p.pause,
						children: "❚❚"
					}),
					/* @__PURE__ */ jsx("button", {
						className: "wa-btn",
						"aria-label": "Stop",
						onClick: p.stop,
						children: "■"
					}),
					/* @__PURE__ */ jsx("button", {
						className: "wa-btn",
						"aria-label": "Next",
						onClick: p.next,
						children: "⏭"
					}),
					/* @__PURE__ */ jsx("button", {
						className: "wa-btn wa-eject",
						"aria-label": "Open files",
						onClick: () => fileRef.current?.click(),
						children: "⏏"
					}),
					/* @__PURE__ */ jsx("span", { className: "wa-spacer" }),
					/* @__PURE__ */ jsx("button", {
						className: `wa-toggle ${p.shuffle ? "wa-on" : ""}`,
						onClick: p.toggleShuffle,
						children: "SHUFFLE"
					}),
					/* @__PURE__ */ jsx("button", {
						className: `wa-toggle ${p.repeat ? "wa-on" : ""}`,
						onClick: p.toggleRepeat,
						children: "↻"
					}),
					/* @__PURE__ */ jsx("span", {
						className: "wa-logo",
						children: "⚡"
					})
				]
			})
		]
	});
}
//#endregion
//#region src/components/winamp/PlaylistManager.tsx
function PlaylistManager({ onClose }) {
	const p = usePlayer();
	const [lists, setLists] = useState([]);
	const [name, setName] = useState("");
	const [msg, setMsg] = useState("");
	const refresh = () => listPlaylists().then(setLists).catch(() => setMsg("Storage unavailable"));
	useEffect(() => {
		refresh();
	}, []);
	const save = async () => {
		const n = name.trim();
		if (!n || !p.tracks.length) return setMsg(p.tracks.length ? "Type a name" : "Playlist is empty");
		try {
			await p.saveAs(n);
			setMsg(`Saved "${n}"`);
			setName("");
			refresh();
		} catch {
			setMsg("Not enough storage space");
		}
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "wa-plm",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "wa-pl-bar",
				children: [
					/* @__PURE__ */ jsx("input", {
						className: "wa-lcd wa-small wa-grow wa-input",
						placeholder: "Playlist name",
						value: name,
						onChange: (e) => setName(e.target.value),
						onKeyDown: (e) => e.key === "Enter" && save()
					}),
					/* @__PURE__ */ jsx("button", {
						className: "wa-toggle",
						onClick: save,
						children: "SAVE"
					}),
					/* @__PURE__ */ jsx("button", {
						className: "wa-toggle",
						onClick: onClose,
						children: "CLOSE"
					})
				]
			}),
			msg && /* @__PURE__ */ jsx("div", {
				className: "wa-pl-warn",
				children: msg
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "wa-plm-list",
				children: [lists.length === 0 && /* @__PURE__ */ jsx("div", {
					className: "wa-pl-empty",
					children: "No saved playlists yet"
				}), lists.map((l) => /* @__PURE__ */ jsxs("div", {
					className: "wa-pl-row",
					children: [/* @__PURE__ */ jsxs("span", {
						className: "wa-pl-name",
						children: [
							l.name,
							" (",
							l.count,
							")"
						]
					}), /* @__PURE__ */ jsxs("span", {
						className: "wa-plm-actions",
						children: [/* @__PURE__ */ jsx("button", {
							className: "wa-toggle",
							onClick: async () => {
								const pl = await loadPlaylist(l.name);
								if (pl) {
									p.loadItems(pl.items);
									setMsg(`Loaded "${l.name}"`);
								}
							},
							children: "LOAD"
						}), /* @__PURE__ */ jsx("button", {
							className: "wa-toggle",
							onClick: async () => {
								await deletePlaylist(l.name);
								refresh();
							},
							children: "DEL"
						})]
					})]
				}, l.name))]
			})
		]
	});
}
//#endregion
//#region src/components/winamp/PlaylistWindow.tsx
function PlaylistWindow() {
	const p = usePlayer();
	const [sel, setSel] = useState(/* @__PURE__ */ new Set());
	const [drag, setDrag] = useState(null);
	const [over, setOver] = useState(false);
	const [lists, setLists] = useState(false);
	const fileRef = useRef(null);
	const dirRef = useRef(null);
	const total = p.tracks.reduce((s, t) => s + (t.duration || 0), 0);
	const click = (e, id) => {
		setSel((s) => {
			const n = new Set(e.ctrlKey || e.metaKey ? s : []);
			if (n.has(id)) n.delete(id);
			else n.add(id);
			return n;
		});
	};
	const remove = () => {
		const cur = p.tracks[p.current];
		if (cur && sel.has(cur.id)) p.stop();
		p.setTracks((ts) => ts.filter((t) => !sel.has(t.id)));
		setSel(/* @__PURE__ */ new Set());
	};
	const reorder = (to) => {
		if (drag === null || drag === to) return;
		p.setTracks((ts) => {
			const n = [...ts];
			const [m] = n.splice(drag, 1);
			n.splice(to, 0, m);
			return n;
		});
		setDrag(null);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: `wa-pl ${over ? "wa-drop" : ""}`,
		onDragOver: (e) => {
			if (e.dataTransfer.types.includes("Files")) {
				e.preventDefault();
				setOver(true);
			}
		},
		onDragLeave: () => setOver(false),
		onDrop: (e) => {
			if (!e.dataTransfer.files.length) return;
			e.preventDefault();
			setOver(false);
			p.addFiles(e.dataTransfer.files);
		},
		children: [
			/* @__PURE__ */ jsx("input", {
				ref: fileRef,
				type: "file",
				multiple: true,
				accept: AUDIO_ACCEPT,
				hidden: true,
				onChange: (e) => e.target.files && p.addFiles(e.target.files)
			}),
			/* @__PURE__ */ jsx("input", {
				ref: dirRef,
				type: "file",
				multiple: true,
				hidden: true,
				webkitdirectory: "",
				onChange: (e) => e.target.files && p.addFiles(e.target.files)
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "wa-pl-list",
				children: [p.tracks.length === 0 && /* @__PURE__ */ jsx("div", {
					className: "wa-pl-empty",
					children: "Drop music files here (MP3, FLAC, WAV, OGG, OPUS, M4A, AIFF...)"
				}), p.tracks.map((t, i) => /* @__PURE__ */ jsxs("div", {
					draggable: true,
					onDragStart: () => setDrag(i),
					onDragOver: (e) => e.preventDefault(),
					onDrop: (e) => {
						if (drag !== null) {
							e.stopPropagation();
							reorder(i);
						}
					},
					onClick: (e) => click(e, t.id),
					onDoubleClick: () => p.playAt(i),
					className: `wa-pl-row ${i === p.current ? "wa-current" : ""} ${sel.has(t.id) ? "wa-selected" : ""}`,
					children: [/* @__PURE__ */ jsxs("span", {
						className: "wa-pl-name",
						children: [
							i + 1,
							". ",
							t.title
						]
					}), /* @__PURE__ */ jsx("span", { children: t.duration ? fmtTime(t.duration) : "" })]
				}, t.id))]
			}),
			p.skipped.length > 0 && /* @__PURE__ */ jsxs("div", {
				className: "wa-pl-warn",
				children: ["Your browser can't play: ", p.skipped.join(", ")]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "wa-pl-bar",
				children: [
					/* @__PURE__ */ jsx("button", {
						className: "wa-toggle",
						onClick: () => fileRef.current?.click(),
						children: "+FILE"
					}),
					/* @__PURE__ */ jsx("button", {
						className: "wa-toggle",
						onClick: () => dirRef.current?.click(),
						children: "+DIR"
					}),
					/* @__PURE__ */ jsx("button", {
						className: "wa-toggle",
						onClick: remove,
						children: "REM"
					}),
					/* @__PURE__ */ jsx("button", {
						className: "wa-toggle",
						onClick: () => setSel(new Set(p.tracks.map((t) => t.id))),
						children: "SEL ALL"
					}),
					/* @__PURE__ */ jsx("button", {
						className: `wa-toggle ${lists ? "wa-on" : ""}`,
						onClick: () => setLists((v) => !v),
						children: "LISTS"
					}),
					/* @__PURE__ */ jsx("span", { className: "wa-spacer" }),
					/* @__PURE__ */ jsxs("span", {
						className: "wa-lcd wa-small",
						children: [
							p.tracks.length,
							" / ",
							fmtTime(total)
						]
					})
				]
			}),
			lists && /* @__PURE__ */ jsx(PlaylistManager, { onClose: () => setLists(false) })
		]
	});
}
//#endregion
//#region src/components/winamp/VisualizerWindow.tsx
var PRESETS = [
	{
		name: "Tunnel of Llamas",
		zoom: 1.04,
		rot: .01,
		shape: "ring"
	},
	{
		name: "Waveform Trails",
		zoom: 1.01,
		rot: 0,
		shape: "wave"
	},
	{
		name: "Spiral Feedback",
		zoom: .97,
		rot: -.03,
		shape: "ring"
	},
	{
		name: "Bass Starburst",
		zoom: 1.06,
		rot: .02,
		shape: "burst"
	}
];
function VisualizerWindow() {
	const p = usePlayer();
	const ref = useRef(null);
	const [preset, setPreset] = useState(0);
	useEffect(() => {
		const c = ref.current;
		const g = c.getContext("2d");
		const tmp = document.createElement("canvas");
		tmp.width = c.width;
		tmp.height = c.height;
		const tg = tmp.getContext("2d");
		let raf = 0;
		let hue = 0;
		const pr = PRESETS[preset];
		g.fillStyle = "#000";
		g.fillRect(0, 0, c.width, c.height);
		const draw = () => {
			raf = requestAnimationFrame(draw);
			const W = c.width, H = c.height;
			const an = p.analyserRef.current;
			const wave = /* @__PURE__ */ new Uint8Array(1024);
			const freq = /* @__PURE__ */ new Uint8Array(256);
			if (an) {
				an.getByteTimeDomainData(wave);
				an.getByteFrequencyData(freq);
			} else wave.fill(128);
			let bass = 0;
			for (let i = 0; i < 12; i++) bass += freq[i];
			bass /= 3060;
			tg.clearRect(0, 0, W, H);
			tg.drawImage(c, 0, 0);
			g.save();
			g.fillStyle = "rgba(0,0,0,0.08)";
			g.fillRect(0, 0, W, H);
			g.translate(W / 2, H / 2);
			g.rotate(pr.rot + bass * .02);
			const z = pr.zoom + bass * .03;
			g.scale(z, z);
			g.globalAlpha = .92;
			g.drawImage(tmp, -W / 2, -H / 2);
			g.restore();
			hue = (hue + .6 + bass * 4) % 360;
			g.strokeStyle = `hsl(${hue},100%,60%)`;
			g.lineWidth = 2 + bass * 4;
			g.beginPath();
			if (pr.shape === "wave") for (let i = 0; i < wave.length; i++) {
				const x = i / wave.length * W;
				const y = H / 2 + (wave[i] - 128) / 128 * H * .4;
				if (i) g.lineTo(x, y);
				else g.moveTo(x, y);
			}
			else if (pr.shape === "ring") {
				const r0 = Math.min(W, H) * (.15 + bass * .15);
				for (let i = 0; i <= 256; i++) {
					const a = i / 256 * Math.PI * 2;
					const r = r0 + (wave[i * 4 % 1024] - 128) / 128 * r0;
					const x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r;
					if (i) g.lineTo(x, y);
					else g.moveTo(x, y);
				}
			} else for (let i = 0; i < 64; i++) {
				const a = i / 64 * Math.PI * 2 + hue / 50;
				const r = freq[i * 2] / 255 * Math.min(W, H) * .45;
				g.moveTo(W / 2, H / 2);
				g.lineTo(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r);
			}
			g.stroke();
		};
		draw();
		return () => cancelAnimationFrame(raf);
	}, [p.analyserRef, preset]);
	return /* @__PURE__ */ jsxs("div", {
		className: "wa-vis",
		children: [/* @__PURE__ */ jsx("canvas", {
			ref,
			width: 520,
			height: 300,
			className: "wa-vis-canvas",
			onDoubleClick: () => ref.current?.requestFullscreen()
		}), /* @__PURE__ */ jsxs("div", {
			className: "wa-pl-bar",
			children: [
				/* @__PURE__ */ jsx("span", {
					className: "wa-lcd wa-small wa-grow",
					children: PRESETS[preset].name
				}),
				/* @__PURE__ */ jsx("button", {
					className: "wa-toggle",
					onClick: () => setPreset((x) => (x + 1) % PRESETS.length),
					children: "NEXT"
				}),
				/* @__PURE__ */ jsx("button", {
					className: "wa-toggle",
					onClick: () => ref.current?.requestFullscreen(),
					children: "FULLSCREEN"
				})
			]
		})]
	});
}
//#endregion
//#region src/assets/llama.png
var llama_default = "/assets/llama-DsHQ5kVU.png";
//#endregion
//#region src/components/winamp/IntroSplash.tsx
function jingle() {
	const ctx = new AudioContext();
	[
		392,
		523.25,
		659.25,
		783.99,
		1046.5
	].forEach((f, i) => {
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = "square";
		o.frequency.value = f;
		const t = ctx.currentTime + 2.4 + i * .12;
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(.08, t + .01);
		g.gain.exponentialRampToValueAtTime(1e-4, t + .3);
		o.connect(g).connect(ctx.destination);
		o.start(t);
		o.stop(t + .35);
	});
	setTimeout(() => ctx.close(), 4e3);
}
function IntroSplash({ onDone }) {
	const start = () => {
		try {
			const u = new SpeechSynthesisUtterance("It really whips the llama's ass!");
			u.pitch = .1;
			u.rate = .85;
			speechSynthesis.speak(u);
		} catch {}
		jingle();
		onDone();
	};
	return /* @__PURE__ */ jsxs("button", {
		className: "wa-intro",
		onClick: start,
		children: [
			/* @__PURE__ */ jsx("img", {
				src: llama_default,
				alt: "Pixel llama",
				width: 816,
				height: 816,
				className: "wa-intro-llama"
			}),
			/* @__PURE__ */ jsx("span", {
				className: "wa-intro-title",
				children: "WINAMP"
			}),
			/* @__PURE__ */ jsx("span", {
				className: "wa-intro-sub",
				children: "It really whips the llama's ass!"
			}),
			/* @__PURE__ */ jsx("span", {
				className: "wa-intro-click wa-blink",
				children: "Click to start"
			})
		]
	});
}
//#endregion
//#region src/components/winamp/Desktop.tsx
var SKINS = [
	"classic",
	"nucleo",
	"ruby",
	"matrix"
];
var DEFAULT = {
	main: {
		x: 40,
		y: 40
	},
	pl: {
		x: 40,
		y: 276
	},
	vis: {
		x: 600,
		y: 40
	}
};
function Shell() {
	const p = usePlayer();
	const [intro, setIntro] = useState(true);
	const [skin, setSkin] = useState("classic");
	const [pos, setPos] = useState(DEFAULT);
	const [show, setShow] = useState({
		pl: true,
		vis: true
	});
	const [menu, setMenu] = useState(null);
	useEffect(() => {
		try {
			const s = JSON.parse(localStorage.getItem("wa-state") || "null");
			if (s?.pos) setPos(s.pos);
			if (s?.skin) setSkin(s.skin);
			if (s?.show) setShow(s.show);
		} catch {}
	}, []);
	useEffect(() => {
		localStorage.setItem("wa-state", JSON.stringify({
			pos,
			skin,
			show
		}));
	}, [
		pos,
		skin,
		show
	]);
	useEffect(() => {
		const k = (e) => {
			if (e.target.tagName === "INPUT" && e.target.type !== "range") return;
			const f = {
				z: p.prev,
				x: p.play,
				c: p.pause,
				v: p.stop,
				b: p.next,
				ArrowLeft: () => p.seek(p.time - 5),
				ArrowRight: () => p.seek(p.time + 5),
				ArrowUp: () => p.setVolume(p.volume + .05),
				ArrowDown: () => p.setVolume(p.volume - .05)
			}[e.key];
			if (f) {
				e.preventDefault();
				f();
			}
		};
		window.addEventListener("keydown", k);
		return () => window.removeEventListener("keydown", k);
	}, [p]);
	const mv = (id) => (np) => setPos((s) => ({
		...s,
		[id]: np
	}));
	return /* @__PURE__ */ jsxs("div", {
		className: "wa-desktop",
		"data-skin": skin,
		onClick: () => setMenu(null),
		children: [
			intro && /* @__PURE__ */ jsx(IntroSplash, { onDone: () => {
				p.ensureGraph();
				setIntro(false);
			} }),
			/* @__PURE__ */ jsx(WaWindow, {
				id: "main",
				title: "WINAMP",
				pos: pos.main,
				onMove: mv("main"),
				width: 550,
				onContextMenu: (e) => {
					e.preventDefault();
					setMenu({
						x: e.clientX,
						y: e.clientY
					});
				},
				children: /* @__PURE__ */ jsx(MainWindow, {
					onTogglePL: () => setShow((s) => ({
						...s,
						pl: !s.pl
					})),
					onToggleVis: () => setShow((s) => ({
						...s,
						vis: !s.vis
					}))
				})
			}),
			show.pl && /* @__PURE__ */ jsx(WaWindow, {
				id: "pl",
				title: "WINAMP PLAYLIST",
				pos: pos.pl,
				onMove: mv("pl"),
				width: 550,
				onClose: () => setShow((s) => ({
					...s,
					pl: false
				})),
				children: /* @__PURE__ */ jsx(PlaylistWindow, {})
			}),
			show.vis && /* @__PURE__ */ jsx(WaWindow, {
				id: "vis",
				title: "MILKDROP",
				pos: pos.vis,
				onMove: mv("vis"),
				width: 540,
				onClose: () => setShow((s) => ({
					...s,
					vis: false
				})),
				children: /* @__PURE__ */ jsx(VisualizerWindow, {})
			}),
			menu && /* @__PURE__ */ jsxs("div", {
				className: "wa-menu",
				style: {
					left: menu.x,
					top: menu.y
				},
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "wa-menu-head",
						children: "Skins"
					}),
					SKINS.map((s) => /* @__PURE__ */ jsxs("button", {
						className: `wa-menu-item ${skin === s ? "wa-on" : ""}`,
						onClick: () => setSkin(s),
						children: [skin === s ? "✓ " : "  ", s]
					}, s)),
					/* @__PURE__ */ jsx("button", {
						className: "wa-menu-item",
						onClick: () => setPos(DEFAULT),
						children: "  reset windows"
					})
				]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "wa-hint",
				children: "Right-click the player for skins · Z X C V B keys · double-click visuals for fullscreen"
			})
		]
	});
}
function Desktop() {
	return /* @__PURE__ */ jsx(PlayerProvider, { children: /* @__PURE__ */ jsx(Shell, {}) });
}
//#endregion
//#region src/routes/index.tsx?tsr-split=component
var SplitComponent = Desktop;
//#endregion
export { SplitComponent as component };
