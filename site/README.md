# AmPly website

Plain static HTML/CSS — no build step, no server code. Includes Windows and Debian Linux downloads and separate step-by-step setup guides. The Download and GitHub buttons in `index.html` point at `github.com/ChrilleMalmberg/amply-amplified-hi-fi-player`.

To update the existing **amply** Cloudflare project: open **Workers & Pages → amply → Create deployment**, upload the latest website ZIP with `index.html` at its top level, then deploy. This updates the website, not the GitHub release attachments.

## Free hosting on Cloudflare Pages

Quickest (no Git needed) — upload the ZIP:
1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
2. Drag `amply-website-cloudflare.zip` in (or the unzipped `site` folder — the files must sit at the top level, not inside a `site` subfolder).
3. Give the project a name, then **Deploy**. You get a free `https://<project-name>.pages.dev` address.

Or connect the repository so every push redeploys automatically:
1. Cloudflare dashboard → Workers & Pages → Create → Pages → **Connect to Git** → pick this repository.
2. Build command: *(leave empty)*. Build output directory: `site`.
3. Deploy. Same free `https://<project-name>.pages.dev` address; add a custom domain later if you buy one.

## Download files

Windows downloads directly from the latest public GitHub release (`AmPly-V3.1.exe`).
Debian downloads directly from release `v3.0` (`amply_3.0.0_amd64.deb`). **Attach that Debian file to the existing v3.0 release before uploading this website update.** GitHub → Releases → edit v3.0 → attach the Debian file → Update release. Keep its filename unchanged.

The Debian installer is about 119 MiB, exceeding Cloudflare Pages' 25 MiB per-file limit, so neither installer is included in the website ZIP. GitHub serves the downloads for free. The website remains a small static upload. See https://developers.cloudflare.com/pages/platform/limits/.

The FREE & OPEN seal is a project mark indicating free use and publicly available code, not an external certification or a license grant. Add an appropriate repository license separately if granting open-source reuse rights.

## Self-host with nginx
Copy the `site` folder to your server, then add a server block (adjust `root` to where you copied it):

```nginx
server {
    listen 80;
    server_name _;
    root /path/to/site;
    index index.html;
    location / { try_files $uri $uri/ =404; }
}
```
