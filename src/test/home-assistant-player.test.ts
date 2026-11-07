import { describe, it, expect, vi } from 'vitest';
import { homeAssistantSnapshot, applyHomeAssistantCommand } from '@/components/winamp/HomeAssistantPlayer';
import type { PlayerApi } from '@/components/winamp/player-context';

function player(overrides: Partial<PlayerApi> = {}) {
  return { playing: true, paused: false, current: 0, tracks: [{ id: 1, title: 'Test song', file: new File(['x'], 'private.wav'), url: 'blob:private', duration: 60 }],
    duration: 60, time: 12, volume: .7, muted: false, play: vi.fn(), pause: vi.fn(), pauseOnly: vi.fn(), stop: vi.fn(), next: vi.fn(), prev: vi.fn(),
    setVolume: vi.fn(), setMuted: vi.fn(), seek: vi.fn(), ...overrides } as unknown as PlayerApi;
}
describe('native Home Assistant audio adapter', () => {
  it('publishes only bounded playback metadata and startup readiness', () => {
    const p = player(); const state = homeAssistantSnapshot(p, false);
    expect(state).toEqual({ state: 'playing', title: 'Test song', track_id: '1', position: 12, duration: 60, volume: .7, muted: false, track_count: 1, ready: false });
    expect(JSON.stringify(state)).not.toContain('private');
    expect(homeAssistantSnapshot(player({ paused: true }), true).state).toBe('paused');
    expect(homeAssistantSnapshot(player({ playing: false }), true).state).toBe('idle');
  });
  it('remote pause is idempotent and never resumes an already paused track', () => {
    const p = player({ paused: true }); applyHomeAssistantCommand(p, { action: 'pause' }); expect(p.pause).not.toHaveBeenCalled(); expect(p.pauseOnly).toHaveBeenCalledTimes(1);
    const playing = player(); applyHomeAssistantCommand(playing, { action: 'pause' }); expect(playing.pauseOnly).toHaveBeenCalledTimes(1); expect(playing.pause).not.toHaveBeenCalled();
  });
  it('volume and mute use the existing player and preserve the saved volume', () => {
    const p = player(); applyHomeAssistantCommand(p, { action: 'volume_mute', value: true });
    expect(p.setMuted).toHaveBeenCalledWith(true); expect(p.setVolume).not.toHaveBeenCalled();
    applyHomeAssistantCommand(p, { action: 'volume_set', value: .35 }); expect(p.setVolume).toHaveBeenCalledWith(.35);
  });
  it('seeks clamp to the current track and invalid payloads are rejected', () => {
    const p = player(); applyHomeAssistantCommand(p, { action: 'seek', value: 900 }); expect(p.seek).toHaveBeenCalledWith(60);
    expect(() => applyHomeAssistantCommand(p, { action: 'volume_set', value: Infinity })).toThrow();
    expect(() => applyHomeAssistantCommand(p, { action: 'volume_mute', value: .5 })).toThrow();
    expect(() => applyHomeAssistantCommand(p, { action: 'seek', value: -1 })).toThrow();
  });
  it('play and navigation require the existing queue', () => {
    const p = player({ tracks: [] });
    for (const action of ['play', 'next', 'previous'] as const) expect(() => applyHomeAssistantCommand(p, { action })).toThrow();
    expect(p.play).not.toHaveBeenCalled();
  });
});
