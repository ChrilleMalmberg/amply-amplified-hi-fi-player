<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Winamp player lives in src/components/winamp with state in player-context; keep the audio path source->EQ(preamp+10 peaking bands, flattened when off)->panner->destination with the analyser as a side tap only, so visuals never alter sound quality. EQ state persists in localStorage key "llamamp-eq".
- Desktop app: `bun run package:win` builds a static SPA via vite.electron.config.ts and scripts/package-desktop.mjs stages runtime-only files and downloads the startup asset to its existing URL path for offline use; package output stays under /tmp/amply-v3.0-release. Electron serves it from 127.0.0.1:47823; keep this origin fixed to preserve playlists. Build electron/installer.nsi with PACKAGE_DIR and INSTALLER_OUT overrides for the staged package.
- Playlists persist in IndexedDB with the original file bytes (src/lib/playlist-store.ts) so they work offline and in the desktop app.
- Music library imports use browser-safe music-metadata and a reserved IndexedDB library record with original bytes; source windows share the catalog but keep independent filters, so offline browsing never moves users' original folders.
- Plug-in settings use a capability catalog in src/lib/audio-plugins.ts and the existing player processors, never simulated native hosting; shared player state keeps EQ and balance controls synchronized and persists balance locally for offline use.
- Browser WindowWorkspace owns canvas geometry; Electron owns independent frameless panel bounds and docking in screen DIPs, including negative monitor coordinates, through electron/window-layout.cjs and a sender-verified preload bridge. The main renderer alone owns audio and queue writes; auxiliary RemotePlayer providers send commands and mirror state over an origin-scoped BroadcastChannel so opening panels never duplicates playback. Preserve player-led snapped movement and proportional group resizing.
- Startup sound uses a short-lived independent Web Audio graph started by the power button and closed on skip/completion/unmount; it must never change the music player's graph or saved audio settings.
- Browser and native panels share the player-skins catalog; native skin changes preserve other wa-state fields and synchronize through storage events so every desktop panel keeps the same appearance.
- The separate static marketing site lives in site/; link large desktop installers to public GitHub release assets rather than bundling them, because Cloudflare Pages limits individual files to 25 MiB.
- Winamp-style shortcuts and utility dialogs live in WinampCommands (one per window, opened via window "amply:dialog" events); pure playback/playlist rules live in src/lib/winamp-features.ts with tests, so browser, main and remote panels behave the same.
