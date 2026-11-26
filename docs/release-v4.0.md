# AmPly v4.0

A major interface and window-management update for the Windows desktop player.

- The Audacious-inspired unified window is now the default, with Playlist, Library, Equalizer and Audio settings in one place.
- Choose Silver, Modern or Matrix for the unified player.
- Switch back to the classic Winamp multi-window interface at any time from View → Interface; playback continues without restarting.
- Double-clicking a title bar now maximizes or restores that window instead of shading it.
- Right-clicking a title bar offers standard window actions, including Maximize/Restore, Minimize, detaching or joining the player group, Reset Windows and Close.
- Reset Windows restores the intended layout and clears maximized and shaded states.
- Window snapping and single-axis resizing no longer change an unrelated dimension or include detached windows.
- The EQ button clearly shows ON in green or OFF in red, with a beat-reactive EQ display.
- Music Library category, column and search sizes are adjustable and saved between sessions.

Download **AmPly-V4.0-Setup.exe**. The installer is unsigned. Only run the installer downloaded from this repository's release; its SHA-256 is in **SHA256SUMS.txt**.

The release workflow runs unit tests, TypeScript and web build checks, then builds on Windows and checks both the packaged executable and a silent installation before publishing. Browser and Linux desktop checks have covered unified/classic switching, playback, skins, maximize/restore and Reset Windows. Physical Windows audio hardware and multi-monitor behavior remain useful follow-up checks.

The Debian installer is not attached to this release, so the website continues to show its availability status instead of linking to a missing file.
