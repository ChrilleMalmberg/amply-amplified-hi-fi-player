# AmPly on Debian-based Linux

## Before you start

- Use a Debian-based desktop on a **64-bit Intel or AMD computer** (`amd64` / `x86_64`). This package is not for ARM computers or Raspberry Pi.
- Download **amply_3.0.0_amd64.deb** from the [v3.0 release](https://github.com/ChrilleMalmberg/amply-amplified-hi-fi-player/releases/tag/v3.0), or the Linux button on [amply.win](https://amply.win). If the release has no Debian file yet, its maintainer must attach it first.
- The package is a Linux test release. A physical Debian desktop test is still pending.

## Install, including from USB

1. Copy the `.deb` file into your **Downloads** folder. Do not try to run the Windows `.exe` on Linux.
2. Double-click the Debian file. If a software installer opens, choose **Install** and enter your password when asked.
3. If double-clicking opens an archive or does nothing, open Downloads in your file manager. Right-click an empty space and choose **Open in Terminal** (the wording varies by desktop).
4. Paste this command and press Enter:

   ```sh
   sudo apt install ./amply_3.0.0_amd64.deb
   ```

5. Enter your account password. The terminal shows no dots or letters while you type; that is normal. Confirm the installation if prompted.

An internet connection may be needed for missing system packages, even when the AmPly installer came from USB. Playback and saved imported music work offline after installation.

## Start and add music

Open **AmPly HiFi Player** in your applications menu, or type `amply` in a terminal. Run it as your normal user, not with `sudo`.

Press **Power on** for the startup sequence or **Skip** to go directly to the player. Drag songs into Playlist, or open Library and choose your music folder. AmPly sorts imported music by tags and does not move your original files. Right-click a window title to choose a skin.

## If something goes wrong

- **File not found:** make sure the terminal is open in the folder containing the downloaded file and that the filename is exactly `amply_3.0.0_amd64.deb`.
- **Wrong architecture:** this installer needs an Intel / AMD 64-bit system; an ARM machine needs a different package.
- **Missing packages / download failed:** connect to the internet and run the install command again. Read the displayed error if it still fails.
- **AmPly will not open:** run `amply` in a terminal and report the error text through [Contact me](https://chrille.pages.dev/) or [GitHub Issues](https://github.com/ChrilleMalmberg/amply-amplified-hi-fi-player/issues), along with your Debian version and desktop environment. Do not disable the sandbox or run the player as root to bypass an error.

## Update or uninstall

To update, download a newer Debian package when available, open a terminal in its folder, and install it with `sudo apt install ./` followed by its exact filename.

To remove the application:

```sh
sudo apt remove amply
```

Removing the application does not automatically erase its per-user saved playlists and settings.