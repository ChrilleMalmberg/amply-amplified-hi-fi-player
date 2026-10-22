import { createFileRoute } from "@tanstack/react-router";
import { Desktop } from "@/components/winamp/Desktop";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Llamamp — classic Winamp 2.0 style music player" },
      { name: "description", content: "Play your own music in a faithful Winamp 2.0 style player with playlist, spectrum and Milkdrop visuals." },
      { property: "og:title", content: "Llamamp — classic Winamp 2.0 style player" },
      { property: "og:description", content: "It really whips the llama's ass. Drop your music files and play." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Desktop,
});
