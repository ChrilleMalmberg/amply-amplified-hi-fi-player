// Llamamp desktop shell. Serves the static build from a private local server
// (127.0.0.1, random port) so storage, audio and routing behave exactly like the web app.
const { app, BrowserWindow, Menu, shell } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "dist-electron", "client");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".json": "application/json", ".txt": "text/plain",
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent((req.url || "/").split("?")[0]);
      let file = path.normalize(path.join(ROOT, url));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        file = path.join(ROOT, "_shell.html");
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    // Fixed port keeps saved playlists (stored per address) between launches.
    server.listen(47823, "127.0.0.1", () => resolve("http://127.0.0.1:47823/"));
  });
}

async function createWindow() {
  const url = await startServer();
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1200,
    height: 760,
    backgroundColor: "#007a7a",
    title: "Llamamp",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, autoplayPolicy: "no-user-gesture-required" },
  });
  win.webContents.setWindowOpenHandler(({ url: u }) => {
    void shell.openExternal(u);
    return { action: "deny" };
  });
  await win.loadURL(url);
}

if (!app.requestSingleInstanceLock()) app.quit();
app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
