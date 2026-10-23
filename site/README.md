# AmPly website

Plain static HTML/CSS — no build step, no server code. The Download and GitHub buttons in `index.html` point at `github.com/ChrilleMalmberg/amply-amplified-hi-fi-player`.

## Free hosting on Cloudflare Pages

Quickest (no Git needed) — upload the ZIP:
1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
2. Drag `amply-website-cloudflare.zip` in (or the unzipped `site` folder — the files must sit at the top level, not inside a `site` subfolder).
3. Give the project a name, then **Deploy**. You get a free `https://<project-name>.pages.dev` address.

Or connect the repository so every push redeploys automatically:
1. Cloudflare dashboard → Workers & Pages → Create → Pages → **Connect to Git** → pick this repository.
2. Build command: *(leave empty)*. Build output directory: `site`.
3. Deploy. Same free `https://<project-name>.pages.dev` address; add a custom domain later if you buy one.

Note: both buttons on the page link to the GitHub repository, so the repository has to be **public** and the `.exe` has to be attached to a **release** before visitors can download it.

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
