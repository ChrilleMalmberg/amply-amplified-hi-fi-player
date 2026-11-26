import { createFileRoute } from "@tanstack/react-router";
import { Desktop } from "@/components/winamp/Desktop";

export const Route = createFileRoute("/player")({
  head: () => ({
    meta: [
      { title: "AmPly HiFi Player — Unified & Classic" },
      { name: "description", content: "Play your music with a 10-band equalizer, three unified skins, or classic independent player windows." },
      { property: "og:title", content: "AmPly v4.0 — Unified & Classic Web Player" },
      { property: "og:description", content: "Audiophile playback of your own music files with a classic look." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Desktop,
});
