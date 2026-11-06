# AmPly v3.1

Reliability update for the Windows desktop player and browser app.

- Sorting, moving and deleting playlist rows preserve the correct playing song across independent desktop panels.
- Deleting the current song unloads it; Play restarts from the remaining queue.
- Interrupted fades no longer stop a later song.
- Saved queue restoration preserves music added during startup.
- Multi-file imports reliably load every duration and release temporary resources.
- Library startup handles server rendering and damaged saved layout settings.
- The official startup artwork ships with the app and works offline without Lovable asset tooling.
- Version labels and the Windows download link consistently identify v3.1.

Download **AmPly-V3.1-Setup.exe**. The installer is unsigned. Only run the installer downloaded from this repository's release; its SHA-256 is in **SHA256SUMS.txt**.

The release workflow runs unit tests, TypeScript and web build checks, then builds on Windows and checks both the packaged executable and a silent installation before publishing. Physical Windows 11 audio hardware and multi-monitor testing remain useful follow-up checks.

The Debian installer is not attached to the existing public release, so the website shows its availability status instead of linking to a missing file.
