# Independent AmPly desktop windows

- Replace the Windows app’s shared outer window with separate, sharp-edged player, playlist, equalizer, library, and plug-in windows.
- Allow each window to move freely between monitors. Keep player-led snapped movement, joined resizing, and explicit separation.
- Keep one music player running: controls in every window operate the same playback and EQ. Library windows retain independent filters.
- Remember desktop positions and sizes, including positions on monitors left of the main display.
- Preserve the existing browser preview; real desktop windows are available in the installed Windows app only.
- Package a revised v3.0 installer and verify window management, offline playback, and shared controls where the sandbox allows. Actual Windows/multiple-monitor execution cannot be certified here.

## Technical approach
- Electron owns independent frameless BrowserWindows, saved screen coordinates, docking gestures, and a narrow, sender-verified preload bridge.
- Only the main renderer owns the audio graph and playlist writes; other panels exchange state and commands through an origin-scoped channel.
- Keep the fixed local origin and runtime-only packaging. Add regression tests for negative monitor coordinates, grouped movement/resizing, and detachment.