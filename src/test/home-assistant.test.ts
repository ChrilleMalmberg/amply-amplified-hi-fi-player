import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { applyControllerCommand, controllerState } from "@/lib/home-assistant-player";
import type { PlayerApi } from "@/components/winamp/player-context";
import { vi } from "vitest";

const require = createRequire(import.meta.url);
const { createController, validCommand, cleanState, privateAddress } = require("../../electron/home-assistant.cjs");
const folders: string[] = [];
afterEach(() => folders.splice(0).forEach(folder => rmSync(folder, { recursive: true, force: true })));

describe("Windows-only Home Assistant control", () => {
  it("never sends file bytes or blob URLs in player state", () => {
    const state = controllerState({ tracks: [{ title: "Local song", file: new Uint8Array([1]), url: "blob:private" }], current: 0, playing: true, paused: false, volume: 0.6, time: 2, duration: 30, shuffle: false, repeatMode: "off" } as unknown as PlayerApi);
    expect(state.queue).toEqual(["Local song"]);
    expect(JSON.stringify(state)).not.toContain("blob:private");
    expect(cleanState(state).title).toBe("Local song");
  });
  it("reports paused playback and makes repeated pause idempotent", async () => {
    const pause = vi.fn();
    const p = { playing: true, paused: true, pause, tracks: [], current: -1 } as unknown as PlayerApi;
    expect(controllerState(p).state).toBe("paused");
    await applyControllerCommand(p, { id: "pause", command: "pause" });
    expect(pause).not.toHaveBeenCalled();
  });
  it("uses the existing player for volume without adding an audio owner", async () => {
    const setVolume = vi.fn();
    await applyControllerCommand({ setVolume } as unknown as PlayerApi, { id: "volume", command: "volume", value: 0.35 });
    expect(setVolume).toHaveBeenCalledWith(0.35);
  });
  it("rejects playback URLs and unsupported output commands", () => {
    expect(validCommand({ command: "play_media", value: "http://example.com/song.mp3" })).toBe(false);
    expect(validCommand({ command: "network_speaker" })).toBe(false);
    expect(validCommand({ command: "play", value: "C:\\secret.wav" })).toBe(false);
  });
  it("bounds volume and validates shuffle and repeat", () => {
    expect(validCommand({ command: "volume", value: 1.01 })).toBe(false);
    expect(validCommand({ command: "volume", value: 0.35 })).toBe(true);
    expect(validCommand({ command: "shuffle", value: "true" })).toBe(false);
    expect(validCommand({ command: "repeat", value: "track" })).toBe(true);
    expect(validCommand({ command: "repeat", value: "one" })).toBe(false);
  });
  it("rejects public clients", () => {
    expect(privateAddress("8.8.8.8")).toBe(false);
    expect(privateAddress("::ffff:192.168.1.20")).toBe(true);
    expect(privateAddress("172.32.0.1")).toBe(false);
  });
  it("is off by default, requires pairing, acknowledges commands and revokes old keys", async () => {
    const folder = mkdtempSync(path.join(tmpdir(), "amply-controller-test-")); folders.push(folder);
    let service: ReturnType<typeof createController>;
    service = createController({ configPath: path.join(folder, "settings.json"), deviceId: "test-pc", sendCommand: (m: { id: string; command: string; value: number }) => {
      if (m.command === "volume") service.update({ ...snapshot, volume: m.value });
      service.result({ id: m.id, ok: true });
    } });
    const snapshot = { state: "idle", volume: 0.8, position: 0, duration: 30, shuffle: false, repeat: "off", current: 0, queue: ["Test song"] };
    expect(service.status().enabled).toBe(false);
    const enabled = await service.enable();
    expect(enabled.enabled).toBe(true);
    const base = `http://127.0.0.1:${enabled.port}`;
    const headers = { Authorization: `Bearer ${enabled.token}` };
    try {
      expect((await fetch(`${base}/v1/state`)).status).toBe(401);
      expect((await fetch(`${base}/v1/state`, { headers })).status).toBe(503);
      service.update(snapshot);
      expect((await fetch(`${base}/v1/state`, { headers: { ...headers, Origin: "http://malicious.test" } })).status).toBe(403);
      const state = await (await fetch(`${base}/v1/state`, { headers })).json();
      expect(state.device_id).toBe("test-pc");
      expect(state.queue).toEqual([{ index: 0, title: "Test song" }]);
      const post = (body: object) => fetch(`${base}/v1/command`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      expect((await post({ command: "track", value: 1 })).status).toBe(400);
      expect((await post({ command: "seek", value: 31 })).status).toBe(400);
      expect((await post({ command: "volume", value: 0.35 })).status).toBe(200);
      expect((await (await fetch(`${base}/v1/state`, { headers })).json()).volume).toBe(0.35);
      await service.rotate();
      expect((await fetch(`${base}/v1/state`, { headers })).status).toBe(401);
    } finally { await service.disable(); }
    expect(service.status().enabled).toBe(false);
    const restored = createController({ configPath: path.join(folder, "settings.json"), deviceId: "test-pc", sendCommand: () => {} });
    await restored.start();
    expect(restored.status().enabled).toBe(false);
  });
});