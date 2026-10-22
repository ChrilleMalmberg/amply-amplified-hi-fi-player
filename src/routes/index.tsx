import { createFileRoute } from "@tanstack/react-router";
import { Desktop } from "@/components/winamp/Desktop";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AmPly HiFi Player V-2.1 — audiophile music player" },
      { name: "description", content: "Play your own lossless music with a 10-band equalizer in a classic retro player." },
      { property: "og:title", content: "AmPly HiFi Player V-2.1" },
      { property: "og:description", content: "Audiophile playback of your own music files with a classic look." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Desktop,
});
