<p align="center">
  <img src="docs/screenshots/amply-logo.jpg" alt="AmPly — Amplified Hi-Fi Player" width="640">
</p>

# AmPly — Amplified Hi-Fi Player

> A reverse-engineered tribute to the classic Winamp 2 — *because it really whipped the Llama's ass.*

AmPly is a Win95-styled, sharp-edged audiophile music player with modern functions. It runs in the browser and as a native Windows desktop app where every panel (player, playlist, equalizer, library) is its own real window.

## Screenshots

| Modern | Matrix Grid (default) |
|---|---|
| ![Modern skin](docs/screenshots/skin-modern.png) | ![Matrix Grid skin](docs/screenshots/skin-matrix-grid.png) |

| Nucleo | Ruby | Matrix |
|---|---|---|
| ![Nucleo skin](docs/screenshots/skin-nucleo.png) | ![Ruby skin](docs/screenshots/skin-ruby.png) | ![Matrix skin](docs/screenshots/skin-matrix.png) |

## Features

- **Bit-perfect playback path** — source → preamp → 10-band EQ → balance → output. Visualizers only listen; they never alter the sound.
- **10-band equalizer** with presets, live dB readouts, and Advanced EQ (precise values, headroom suggestion, flat reset).
- **Music library** — add folders, auto-sorted by artists, albums, genres, folders and sources using file tags.
- **Playlists** saved and restored between sessions, fully offline.
- **Skins** — Silver, Classic, Nucleo, Ruby, Matrix and Modern (right-click a title bar or View → Skins).
- **Snapping windows** — panels docked to the player move, resize and maximize together; detach any panel to use it alone, even on another monitor.
- **Menu bar** — File, Playlist, View and Settings menus.
- **Neon startup sequence** with progress bar and original startup sound.

## Windows app

Download the latest installer from Releases and run it. It is unsigned, so Windows SmartScreen may warn: click **More info → Run anyway**.

Build it yourself:

```sh
bun install
bun run package:win
```

## Development

```sh
bun install
bun run dev
bunx vitest run
```

## Built with

TanStack Start · React · TypeScript · Tailwind CSS · Web Audio API · Electron

## Disclaimer

AmPly is an independent project, not affiliated with Winamp or Nullsoft. Names mentioned belong to their respective owners.
