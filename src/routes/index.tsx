import { createFileRoute } from "@tanstack/react-router";
import landingHtml from "../../site/index.html?raw";
import landingCss from "../../site/style.css?url";

// Render the supplied landing page on the existing domain. Image assets are
// served locally; the independent desktop renderer still mounts Desktop directly.
const landingBody = (landingHtml.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? "")
  .replaceAll('src="img/', 'src="/marketing/img/');

function MarketingHome() {
  return <div className="marketing-page" dangerouslySetInnerHTML={{ __html: landingBody }} />;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AmPly — Amplified Hi-Fi Player" },
      { name: "description", content: "Download AmPly v3.1 for Windows: a free retro music player with a 10-band EQ, offline playlists and independent desktop windows." },
      { property: "og:title", content: "AmPly — Amplified Hi-Fi Player" },
      { property: "og:description", content: "Download AmPly v3.1 for Windows, explore the skins and get started with offline music playback." },
      { property: "og:image", content: "https://amply.win/marketing/img/amply-logo.jpg" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: landingCss },
      { rel: "canonical", href: "https://amply.win/" },
    ],
  }),
  component: MarketingHome,
});
