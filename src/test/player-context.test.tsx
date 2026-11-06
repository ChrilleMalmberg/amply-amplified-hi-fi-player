import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerProvider, usePlayer, type Track } from "@/components/winamp/player-context";
import { loadPlaylist, savePlaylist, type StoredPlaylist } from "@/lib/playlist-store";
import { PlayerBroadcaster, RemotePlayerProvider } from "@/components/winamp/RemotePlayer";
import { readTags } from "@/lib/winamp-logic";

vi.mock("@/lib/winamp-logic", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/winamp-logic")>()),
  readTags: vi.fn(async () => ({})),
}));

vi.mock("@/lib/playlist-store", () => ({
  QUEUE_KEY: "__queue__",
  loadPlaylist: vi.fn(async () => undefined),
  savePlaylist: vi.fn(async () => "__queue__"),
}));

class TestAudio extends EventTarget {
  static instances: TestAudio[] = [];
  static metadataImmediately = false;
  private source = "";
  onloadedmetadata: (() => void) | null = null;
  onerror: (() => void) | null = null;
  get src() {
    return this.source;
  }
  set src(value: string) {
    this.source = value;
    if (value && TestAudio.metadataImmediately) this.onloadedmetadata?.();
  }
  currentTime = 0;
  duration = 180;
  volume = 0.8;
  paused = true;
  preload = "";
  constructor() {
    super();
    TestAudio.instances.push(this);
  }
  play = vi.fn(async () => {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  });
  pause = vi.fn(() => {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  });
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
  load = vi.fn();
  canPlayType = () => "probably";
}

class TestAudioContext {
  static instances: TestAudioContext[] = [];
  sampleRate = 48000;
  destination = {};
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
  constructor() {
    TestAudioContext.instances.push(this);
  }
  createMediaElementSource = () => this.node();
  createGain = () => ({ ...this.node(), gain: { value: 1 } });
  createBiquadFilter = () => ({
    ...this.node(),
    frequency: { value: 0 },
    Q: { value: 0 },
    gain: { value: 0 },
  });
  createStereoPanner = () => ({ ...this.node(), pan: { value: 0 } });
  createAnalyser = () => this.node();
  private node() {
    return { connect: vi.fn((target: unknown) => target) };
  }
}

function queue(): Track[] {
  return ["Alpha", "Bravo", "Charlie"].map((title, i) => ({
    id: i + 1,
    title,
    duration: 120 + i * 30,
    file: new File(["audio"], `${title}.wav`, { type: "audio/wav" }),
    url: `blob:track-${i + 1}`,
  }));
}

async function player() {
  const hook = renderHook(usePlayer, { wrapper: PlayerProvider });
  await act(async () => {});
  act(() => hook.result.current.setTracks(queue()));
  act(() => hook.result.current.playAt(1));
  return { ...hook, audio: TestAudio.instances[0]! };
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  TestAudio.instances = [];
  TestAudio.metadataImmediately = false;
  TestAudioContext.instances = [];
  vi.mocked(loadPlaylist).mockReset().mockResolvedValue(undefined);
  vi.mocked(savePlaylist).mockClear();
  vi.mocked(readTags).mockReset().mockResolvedValue({});
  vi.stubGlobal("Audio", TestAudio);
  vi.stubGlobal("AudioContext", TestAudioContext);
  let urlId = 0;
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => `blob:new-track-${++urlId}`),
    revokeObjectURL: vi.fn(),
  });
});

describe("File import metadata", () => {
  it("keeps durations even when metadata arrives before the import finishes", async () => {
    TestAudio.metadataImmediately = true;
    const { result } = renderHook(usePlayer, { wrapper: PlayerProvider });
    await act(async () => {});
    await act(async () => result.current.addFiles(queue().map((t) => t.file)));
    expect(result.current.tracks.map((t) => t.duration)).toEqual([180, 180, 180]);
    expect(TestAudio.instances.slice(1).every((m) => m.src === "")).toBe(true);
  });

  it("releases pending metadata probes when rows are removed", async () => {
    const { result } = renderHook(usePlayer, { wrapper: PlayerProvider });
    await act(async () => {});
    await act(async () => result.current.addFiles([queue()[0]!.file]));
    const metadata = TestAudio.instances[1]!;
    expect(metadata.src).not.toBe("");
    act(() => result.current.setTracks([]));
    expect(metadata.src).toBe("");
    expect(metadata.onloadedmetadata).toBeNull();
    expect(metadata.onerror).toBeNull();
  });

  it("discards an import that finishes reading tags after unmount", async () => {
    let finish!: (tags: Awaited<ReturnType<typeof readTags>>) => void;
    vi.mocked(readTags)
      .mockResolvedValueOnce({})
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
    const { result, unmount } = renderHook(usePlayer, { wrapper: PlayerProvider });
    await act(async () => {});
    let importing!: Promise<void>;
    await act(async () => {
      importing = result.current.addFiles(
        queue()
          .slice(0, 2)
          .map((t) => t.file),
      );
    });
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    unmount();
    await act(async () => {
      finish({});
      await importing;
    });
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:new-track-1");
    expect(TestAudio.instances).toHaveLength(1);
  });
});

describe("Playback lifecycle", () => {
  it("cancels a fade when another song starts and restores the user's volume", async () => {
    const { result, audio } = await player();
    act(() => result.current.fadeStop());
    act(() => vi.advanceTimersByTime(500));
    expect(audio.volume).toBeLessThan(0.8);
    act(() => result.current.playAt(2));
    expect(audio.volume).toBe(0.8);
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.playing).toBe(true);
    expect(audio.src).toBe("blob:track-3");
  });

  it("cancels a fade on Stop so it cannot stop later playback", async () => {
    const { result, audio } = await player();
    act(() => result.current.fadeStop());
    act(() => vi.advanceTimersByTime(500));
    act(() => result.current.stop());
    expect(audio.volume).toBe(0.8);
    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.playing).toBe(true);
  });

  it("releases the audio graph, file URLs and fade timer on unmount", async () => {
    const { result, audio, unmount } = await player();
    act(() => result.current.fadeStop());
    act(() => vi.advanceTimersByTime(100));
    unmount();
    expect(audio.paused).toBe(true);
    expect(audio.src).toBe("");
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
    expect(TestAudioContext.instances[0]!.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Queue persistence", () => {
  it("does not overwrite stored music with an empty queue after a read failure", async () => {
    vi.mocked(loadPlaylist).mockRejectedValueOnce(new Error("Database unavailable"));
    const { result } = renderHook(usePlayer, { wrapper: PlayerProvider });
    await act(async () => {});
    await act(async () => vi.advanceTimersByTime(1000));
    expect(savePlaylist).not.toHaveBeenCalled();
    act(() => result.current.setTracks(queue()));
    await act(async () => vi.advanceTimersByTime(800));
    expect(savePlaylist).toHaveBeenCalledOnce();
  });

  it("restores an untouched queue and saves later edits", async () => {
    vi.mocked(loadPlaylist).mockResolvedValueOnce({
      name: "__queue__",
      items: [queue()[0]!],
      savedAt: 1,
    });
    const { result } = renderHook(usePlayer, { wrapper: PlayerProvider });
    await act(async () => {});
    expect(result.current.tracks.map((t) => t.title)).toEqual(["Alpha"]);
    act(() => result.current.setTracks([]));
    await act(async () => vi.advanceTimersByTime(800));
    expect(savePlaylist).toHaveBeenLastCalledWith(expect.objectContaining({ items: [] }));
  });

  it("preserves and saves new music added while the saved queue is still loading", async () => {
    let restore!: (value: StoredPlaylist) => void;
    vi.mocked(loadPlaylist).mockReturnValueOnce(
      new Promise((resolve) => {
        restore = resolve;
      }),
    );
    const { result } = renderHook(usePlayer, { wrapper: PlayerProvider });
    act(() => result.current.setTracks(queue()));
    await act(async () => restore({ name: "__queue__", items: [queue()[0]!], savedAt: 1 }));
    expect(result.current.tracks).toHaveLength(3);
    await act(async () => vi.advanceTimersByTime(800));
    expect(savePlaylist).toHaveBeenLastCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([expect.objectContaining({ title: "Bravo" })]),
      }),
    );
  });

  it("does not create file URLs if the saved queue arrives after unmount", async () => {
    let restore!: (value: StoredPlaylist) => void;
    vi.mocked(loadPlaylist).mockReturnValueOnce(
      new Promise((resolve) => {
        restore = resolve;
      }),
    );
    const { unmount } = renderHook(usePlayer, { wrapper: PlayerProvider });
    unmount();
    await act(async () => restore({ name: "__queue__", items: [queue()[0]!], savedAt: 1 }));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});

describe("Desktop playlist commands", () => {
  it("preserves playback when a remote panel reorders or removes rows", async () => {
    class TestChannel {
      static peers = new Set<TestChannel>();
      onmessage: ((event: { data: unknown }) => void) | null = null;
      constructor(readonly name: string) {
        TestChannel.peers.add(this);
      }
      postMessage(data: unknown) {
        for (const peer of TestChannel.peers) {
          if (peer !== this && peer.name === this.name)
            queueMicrotask(() => peer.onmessage?.({ data }));
        }
      }
      close() {
        TestChannel.peers.delete(this);
      }
    }
    vi.stubGlobal("BroadcastChannel", TestChannel);
    const owner = renderHook(usePlayer, {
      wrapper: ({ children }) => (
        <PlayerProvider>
          <PlayerBroadcaster />
          {children}
        </PlayerProvider>
      ),
    });
    const remote = renderHook(usePlayer, { wrapper: RemotePlayerProvider });
    await act(async () => {});
    act(() => owner.result.current.setTracks(queue()));
    act(() => owner.result.current.playAt(1));
    await act(async () => {});
    expect(remote.result.current.tracks).toHaveLength(3);
    await act(async () => remote.result.current.setTracks((old) => [old[1]!, old[0]!, old[2]!]));
    expect(owner.result.current.current).toBe(0);
    expect(remote.result.current.current).toBe(0);
    expect(TestAudio.instances).toHaveLength(1);
    expect(TestAudio.instances[0]!.src).toBe("blob:track-2");
    await act(async () => remote.result.current.setTracks((old) => old.filter((t) => t.id !== 2)));
    expect(owner.result.current.current).toBe(-1);
    expect(remote.result.current.playing).toBe(false);
    expect(TestAudio.instances[0]!.src).toBe("");
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Playlist edits during playback", () => {
  it("keeps the playing song and follows its new next row after a reorder", async () => {
    const { result, audio } = await player();
    act(() => result.current.setTracks(([a, b, c]) => [b!, a!, c!]));
    expect(result.current.current).toBe(0);
    expect(result.current.duration).toBe(150);
    expect(audio.src).toBe("blob:track-2");
    expect(result.current.playing).toBe(true);
    act(() => audio.dispatchEvent(new Event("ended")));
    expect(audio.src).toBe("blob:track-1");
  });

  it("keeps the current song when a preceding row is removed", async () => {
    const { result, audio } = await player();
    act(() => result.current.setTracks((old) => old.slice(1)));
    expect(result.current.current).toBe(0);
    expect(audio.src).toBe("blob:track-2");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:track-1");
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:track-2");
    act(() => result.current.next());
    expect(audio.src).toBe("blob:track-3");
  });

  it("unloads a removed playing song so Play cannot restart its stale source", async () => {
    const { result, audio } = await player();
    act(() => result.current.setTracks((old) => old.filter((t) => t.id !== 2)));
    expect(result.current.current).toBe(-1);
    expect(result.current.playing).toBe(false);
    expect(result.current.paused).toBe(false);
    expect(result.current.time).toBe(0);
    expect(audio.src).toBe("");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:track-2");
    act(() => result.current.play());
    expect(audio.src).toBe("blob:track-1");
  });

  it("clears playback and releases every URL when the queue is emptied", async () => {
    const { result, audio } = await player();
    act(() => result.current.setTracks([]));
    expect(result.current.current).toBe(-1);
    expect(result.current.playing).toBe(false);
    expect(audio.src).toBe("");
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
  });

  it("applies consecutive functional edits to the latest queue", async () => {
    const { result, audio } = await player();
    act(() => {
      result.current.setTracks((old) => old.slice(1));
      result.current.setTracks((old) => [...old].reverse());
    });
    expect(result.current.tracks.map((t) => t.id)).toEqual([3, 2]);
    expect(result.current.current).toBe(1);
    expect(audio.src).toBe("blob:track-2");
  });
});
