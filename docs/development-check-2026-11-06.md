# Development check — 6 November 2026

First reliability pass against `main` at `b4febc3`.

## Fixes

- Playlist sorting, moving, reversing and deleting now track the active song by its ID. Editing rows before the active song no longer changes its displayed identity, duration or subsequent playback order. Desktop panel commands use the same queue update path.
- Removing the active song unloads its media source and resets playback. Pressing Play starts from the remaining queue instead of restarting a deleted file. Removed file URLs and pending metadata probes are released.
- Interrupting a fade with Play, Pause, Stop, a track change or a volume change cancels the old timer and restores the selected volume. An earlier fade cannot stop the next song. Unmounting closes the audio graph and clears outstanding resources.
- Saved queue restoration cannot overwrite music added while IndexedDB is opening, or update an unmounted player. Changes made during restoration are saved afterward. A failed read leaves the stored queue untouched until the user edits the queue.
- Multi-file imports commit all rows before starting metadata probes. Previously, a fast metadata response for an early file could arrive before its row existed, losing its duration. Imports finishing after unmount are discarded.
- Library layout settings load after hydration, preventing `localStorage is not defined` during server rendering. Invalid saved column settings fall back to usable defaults.

## Validation

| Check | Result |
| --- | --- |
| `bun install --frozen-lockfile --ignore-scripts` | Passed; dependency manifests and Bun lockfile unchanged |
| `npm test -- --reporter=dot` | 72 tests passed, including 23 new regression checks |
| `./node_modules/.bin/tsc --noEmit` | Passed |
| `npm run build` | Passed; web / Cloudflare output generated |
| `npm run build:desktop` | Passed; static desktop output generated |
| ESLint on the two new test files | Passed |
| ESLint on `src` with only `prettier/prettier` disabled | No errors; existing Fast Refresh and remote cleanup warnings remain |
| Standard source lint | Still fails on existing formatting debt; no repository-wide reformat included |
| Chromium interface and playback check | Passed; no uncaught page errors |

The browser check used generated 20-second WAV files and exercised startup, import and durations, actual media playback, sorting during playback, next, pause/resume, seeking, stopping, deleting the current song and restarting, interrupted fade, EQ persistence, queue restoration, library folder import and search, library Play/Queue, named playlist save/load, and playback with browser networking disabled. The startup and library rendered without the previous server-rendering error.

Desktop command regression coverage mounts an audio-owning player and a remote provider, sends commands through a test BroadcastChannel, and checks that both agree while only one audio element owns playback.

## Remaining verification

- Run the revised app on a physical Windows 11 computer, including installer launch and independent desktop panels. This pass does not produce or publish a replacement installer.
- Check representative MP3, FLAC, AAC and other supported files, hardware output, and physical multi-monitor behavior. WAV playback and the existing audio processor tests do not establish bit-perfect output or universal codec compatibility.
- Address repository formatting and lint warnings in a separate change, then add continuous integration for the tests, type checks and builds.

The existing skins, audio signal path, local storage keys and fixed desktop origin are preserved. Generated build output is excluded from this source change.
