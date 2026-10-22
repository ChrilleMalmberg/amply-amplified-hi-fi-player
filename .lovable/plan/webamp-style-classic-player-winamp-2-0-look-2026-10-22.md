# Webamp-style classic player (Winamp 2.0 look)

A web music player that copies the look and feel of the original Winamp 2.0. The visuals are rebuilt from scratch, not copied. It plays your own music files, and nothing is uploaded.

## What you get
- **Main window** (275x116, the original size, scaled up): green LED time display, scrolling song title, kbps/kHz readouts, a stereo/mono light, a 19-bar spectrum analyzer that switches to an oscilloscope when clicked, volume and balance sliders, a seek bar, prev/play/pause/stop/next/eject buttons, shuffle and repeat, and the "EQ" and "PL" toggles.
- **Playlist window**: drag files or folders onto it. You can double-click to play, use ADD, REM and SEL buttons, select several tracks, see total time, and reorder tracks by dragging them.
- **Milkdrop-style visuals window**: a canvas that reacts to the music. It cycles through several effects (warping tunnels, waveform trails, color feedback). It has a fullscreen button and can switch to the next effect.
- **Draggable windows** with a title-bar grip that snap to each other and to the screen edges, like the original. Each window has the classic minimize/close controls.
- **Skins**: Classic 2.0 (the default grey and green), plus a few extra colour themes you can pick from the right-click menu.
- **Llama intro**: on first click (browsers block sound until you interact), a splash screen shows a pixel llama and says "it really whips the llama's ass!" in a deep, robot-like voice, followed by an original short jingle. The real Winamp audio clip is copyrighted, so I'll recreate the effect instead of copying it.
- Keyboard shortcuts like the original: Z X C V B for prev, play, pause, stop and next; arrow keys for seeking and volume.

## Technical details
- Single route `/` with its own page title and description; the 404 page is kept.
- The Web Audio API powers playback, the analyzer, and the visuals.
- Files are read in the browser using object URLs. ID3 tags are read with a small parser (title/artist), and the file name is used if tags are missing.
- The pixel look comes from CSS: bevelled borders, bitmap-style fonts (VT323 / a pixel font from Google Fonts), and image-rendering pixelated. Skin colours are defined as theme tokens in styles.css.
- Components: MainWindow, PlaylistWindow, VisualizerWindow, WindowFrame (dragging and snapping), IntroSplash. Shared player state lives in a React context.
- Window positions and the chosen skin are saved in localStorage. No backend is needed.
- Tests check the snapping math and the shuffle/repeat next-track logic.
