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
- Desktop app: `bun run package:win` builds a static SPA via vite.electron.config.ts (bypasses the Cloudflare/SSR wrapper) and Electron serves it from 127.0.0.1:47823; keep the port fixed so saved playlists (stored per address) persist. Installer: makensis electron/installer.nsi.
- Playlists persist in IndexedDB with the original file bytes (src/lib/playlist-store.ts) so they work offline and in the desktop app.
- Music library imports use browser-safe music-metadata and a reserved IndexedDB library record with original bytes; source windows share the catalog but keep independent filters, so offline browsing never moves users' original folders.
- Plug-in settings use a capability catalog in src/lib/audio-plugins.ts and the existing player processors, never simulated native hosting; shared player state keeps EQ and balance controls synchronized and persists balance locally for offline use.
- WindowWorkspace owns saved geometry and detached membership; edge-connected windows resize proportionally through window-layout helpers while title-bar dragging separates individual windows, so docking never requires scaling text or audio controls.
- Startup sound uses a short-lived independent Web Audio graph started by the power button and closed on skip/completion/unmount; it must never change the music player's graph or saved audio settings.
