# AmPly website

Plain static HTML/CSS — no build step, no server code. The Download and GitHub buttons in `index.html` point at `github.com/ChrilleMalmberg/amply-amplified-hi-fi-player`.

## Free hosting on Cloudflare Pages
1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick this repository.
2. Build command: *(leave empty)*. Build output directory: `site`.
3. Deploy. You get a free `https://<project-name>.pages.dev` address; add a custom domain later if you buy one.

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
