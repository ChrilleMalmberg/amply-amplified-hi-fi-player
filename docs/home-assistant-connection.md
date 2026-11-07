# Optional Home Assistant connection — test branch

This branch introduces an experimental local connection for the already-running Windows desktop application. It does not replace the published v3.1 release or publish a new installer.

## User flow

1. Close other AmPly copies, extract the **entire portable test build**, and open `Ampli Player.exe`. The existing v3.1 installation remains on disk.
2. Load a playlist normally. Open **Options → Home Assistant connection…**.
3. Enter the Home Assistant server's IPv4 address and choose a connection port (default `47824`). Enable the connection. It is disabled on a new profile until you do this.
4. Pair the companion Home Assistant custom integration using the Windows computer address, port, certificate SHA-256 fingerprint and pairing key displayed in that window.
5. Select the resulting AmPly `media_player` entity in the existing AmPly card.

Windows Firewall may need a rule for this program and TCP port on the **Private** network profile, restricted to the HA server address. No router port forwarding is required. The application itself also rejects requests from every other address.

The pairing key is hidden by default and hidden again when the settings window loses focus. Regenerating it revokes old authorization. Disabling closes the listener immediately. Closing AmPly makes the HA entity unavailable; it does not silently control a different device.

## Protocol and security boundaries

- HTTPS, TLS 1.2 or newer, on a dedicated endpoint. The existing player origin stays at `127.0.0.1:47823`, preserving local playlists.
- A per-installation self-signed certificate is verified by an explicitly copied SHA-256 fingerprint. The companion client never disables certificate verification or follows redirects.
- A random 256-bit pairing key is required for every request. Both it and the TLS private key are encrypted on disk through Electron safeStorage (Windows DPAPI).
- The configured HA IPv4 address is checked independently of the key. Requests with a browser `Origin` header are rejected. There is no CORS API or unauthenticated playback endpoint.
- `GET /v1/state` exposes bounded playback metadata, not original files, paths, URLs, playlists, credentials or arbitrary renderer state. Stale renderer heartbeats are unavailable.
- `POST /v1/command` accepts only play, idempotent pause, stop, next, previous, seek, volume and mute. Bodies are bounded to 1 KiB. It cannot launch processes, import files, browse folders or stream music.
- Only the main renderer owns audio. Validated main-process IPC forwards commands to that existing player; auxiliary windows cannot publish its playback state or acknowledge its requests.
- HTTP acknowledgment means the existing player accepted the command. Home Assistant's state is still taken from subsequent playback updates, not optimistic success assumptions.

## Tests

`bun run test`, `bun run test:bridge`, `bunx tsc --noEmit`, `bun run build` and `bun run build:desktop` cover shared behavior, TypeScript and both builds. Protocol tests make real HTTPS requests with ephemeral identities. The Windows workflow additionally tests a packaged app with generated WAVs and real Electron IPC, including key rotation, disabling, encrypted storage and restarting with the same pairing.

No test uses the owner's Home Assistant, Windows profile or physical speakers. Cross-machine routing, Windows Firewall and physical audio hardware require the owner test after the automated checks pass.
