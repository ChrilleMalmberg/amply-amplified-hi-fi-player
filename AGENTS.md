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
