# AmPly Windows controller — private test 0.1.0

Control music playing on your Windows PC from Home Assistant. This is a **custom integration**, not a Home Assistant app/add-on. It works with Home Assistant Container and Home Assistant OS. It is not listed in HACS or an official marketplace yet.

## What works

- Play, pause, stop, previous and next.
- Volume, seek, shuffle and repeat (off / playlist / track).
- Current title, duration, playback position and connection status.
- Select a track from the existing AmPly queue through Home Assistant's source selector (up to 2,000 tracks).
- Use normal Home Assistant media-player actions in automations.

Music stays on the PC and plays through its current Windows audio output. Keep AmPly running and the PC awake. This does not remotely launch AmPly, upload songs, stream to network speakers, or control the EQ. Closing AmPly or disabling its controller makes the entity unavailable.

## Install on Windows

1. Close AmPly, then install the supplied **AmPly-V4.0-HomeAssistant-Test-Setup.exe**. This is a test build of 4.0, not a new public release. It uses the existing playlist storage origin.
2. Open AmPly and finish or skip startup. Add a few music files to the queue and confirm they play locally.
3. Open **Options → Home Assistant… → Enable controller**.
4. Note the **PC address** and port **47824**. Click the copy icon beside the pairing key. Do not post that key in chat, GitHub, screenshots or logs.
5. If Windows asks about network access, allow AmPly on **Private networks only**. If there is no prompt, open Windows Defender Firewall → Advanced settings → Inbound Rules → New Rule → Port → TCP → Specific local ports: 47824 → Allow the connection → select Private only → name it AmPly Home Assistant. In the rule's Properties → Scope, restrict remote addresses to your Home Assistant host's address if possible.

Use only a trusted home LAN. This first controller uses HTTP, not TLS: the key travels unencrypted inside your LAN. Never forward this port on your router or expose it through a public proxy. Browser-origin requests and public source addresses are rejected, but this is not a replacement for firewall restrictions.

## Install on Home Assistant Container

1. Make a backup of your Home Assistant configuration.
2. Extract the supplied integration ZIP. It contains a `custom_components/amply` folder.
3. Copy that **amply** folder into **custom_components** inside your Home Assistant configuration directory (the host folder mounted as `/config` in your Container). Create `custom_components` if it does not exist. Final path inside the container: `/config/custom_components/amply/manifest.json`.
4. Restart Home Assistant, then refresh your browser.
5. Open **Settings → Devices & services → Add integration**, search **AmPly Windows**, and enter the PC address, port 47824 and pairing key.
6. Add its media-player entity to your dashboard using a Media control card. Press play and confirm the sound comes from the PC. Test pause, next, volume and seek.

Do not use `127.0.0.1` as the PC address unless Home Assistant runs on the very same host: inside a container it normally refers to the container itself. No Home Assistant cloud token is needed. The key is generated and saved locally by AmPly when the controller is enabled.

## Troubleshooting

- **Cannot connect:** keep AmPly open, finish startup, enable the controller, use the private PC address (not amply.win), and check Private-network firewall access. Home Assistant must be able to reach the PC on the LAN.
- **Authentication failed:** copy the current key again. Replacing the key revokes the old one; Home Assistant will ask you to reauthenticate.
- **PC address changed:** reserve its address in your router, or remove and add the integration again with the new address.
- **Paused state:** repeated pause commands leave playback paused; play resumes it.
- **No music:** import files in AmPly first. The integration controls the current queue, not files elsewhere on the PC.
- **Disable:** Options → Home Assistant → Disable controller. Existing pairings cannot control the PC while it is disabled.

## Verification and community release

All 84 player/controller tests pass, along with three Python API tests. Home Assistant 2026.11.1 was also paired through its real setup flow to a packaged Linux Electron player: play/pause/resume, volume, seek, track changes, shuffle/repeat, queue selection and duplicate-pairing prevention passed. This verifies the shared controller logic, not Windows installation or your home network. Your Windows PC and live Home Assistant installation still need testing before a community release. The integration follows the 2026.11 probatio config-flow format.

After your test, a separate community step can add HACS packaging, wider version tests and release documentation. No marketplace submission is included in this private test.