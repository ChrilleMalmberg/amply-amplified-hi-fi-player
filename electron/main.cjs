// Independent Winamp-style desktop panels, sharing one audio owner.
const { app, BrowserWindow, Menu, shell, ipcMain, screen, dialog } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const layout = require("./window-layout.cjs");

const ROOT = path.join(__dirname, "..", "dist-electron", "client");
const ORIGIN = "http://127.0.0.1:47823";
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".json": "application/json", ".txt": "text/plain",
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        if (req.headers.host !== "127.0.0.1:47823") { res.writeHead(403); res.end(); return; }
        const url = decodeURIComponent((req.url || "/").split("?")[0]);
        let file = path.resolve(ROOT, `.${url}`);
        const relative = path.relative(ROOT, file);
        if (relative.startsWith("..") || path.isAbsolute(relative)) { res.writeHead(403); res.end(); return; }
        if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
          if (url === "/") file = path.join(ROOT, "_shell.html");
          else { res.writeHead(404); res.end(); return; }
        }
        res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "X-Content-Type-Options": "nosniff" });
        const stream = fs.createReadStream(file);
        stream.on("error", () => res.destroy()); stream.pipe(res);
      } catch {
        res.writeHead(400); res.end();
      }
    });
    server.on("error", reject);
    server.listen(47823, "127.0.0.1", () => resolve(`${ORIGIN}/`));
  });
}

const windows = new Map();
let saved = { windows: {}, detached: [] };
let started = false, quitting = false, gesture = null, saveTimer;
const sizes = { main: [550, 220], pl: [550, 300], eq: [550, 260], library: [680, 640], plugins: [760, 740] };
const titles = { main: "AmPly HiFi Player V-3.0", pl: "AmPly Playlist", eq: "AmPly Equalizer", library: "AmPly Music Library", plugins: "AmPly Advanced EQ" };
function dataPath() { return path.join(app.getPath("userData"), "desktop-windows.json"); }
function rects() {
  return [...windows.values()].filter(p => !p.win.isDestroyed() && p.win.isVisible()).map(p => {
    const b = p.win.getBounds(); return { id: p.id, x: b.x, y: b.y, w: b.width, h: b.height, minW: 320, minH: p.shaded ? 26 : p.kind === "main" ? 180 : p.kind === "eq" ? 200 : 140 };
  });
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(dataPath()), { recursive: true }); fs.writeFileSync(dataPath(), JSON.stringify(saved)); } catch { /* disk unavailable */ }
  }, 200);
}
function remember(p) {
  if (!started || p.win.isDestroyed()) return;
  const b=p.win.getBounds();
  saved.windows[p.id]={kind:p.kind,source:p.source,x:b.x,y:b.y,w:b.width,h:p.shaded?p.fullHeight:b.height,visible:p.win.isVisible()};
  save();
}
function states() {
  const all=rects();
  for(const p of windows.values()) if(!p.win.isDestroyed()) p.win.webContents.send("amply:window-state",{detached:saved.detached.includes(p.id),grouped:layout.connected(p.id,all,saved.detached).length>1});
}
function apply(rectangles) {
  for(const r of rectangles) {
    const p=windows.get(r.id); if(!p || p.win.isDestroyed()) continue;
    p.win.setBounds({x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.w),height:Math.round(r.h)});remember(p);
  }
  states();
}
function defaultRect(kind) {
  const a=screen.getPrimaryDisplay().workArea;
  const main=windows.get("main")?.win.getBounds();
  const x=main?.x ?? a.x+32, y=main?.y ?? a.y+32;
  const [w,h]=sizes[kind];
  return {x:kind==="library"?x+570:kind==="plugins"?x+30:x,y:kind==="pl"?y+220:kind==="eq"?y+520:kind==="plugins"?y+40:y,w,h};
}
function makeWindow(id,kind,source="",startup=false) {
  const existing=windows.get(id); if(existing && !existing.win.isDestroyed()) {existing.win.show();existing.win.focus();remember(existing);states();return existing;}
  const areas=screen.getAllDisplays().map(d=>d.workArea);
  const previous=saved.windows[id];
  const rect=layout.restore(previous,areas) || layout.restore(defaultRect(kind),areas);
  const width=startup?760:rect.w, height=startup?530:rect.h;
  const win = new BrowserWindow({
    x:rect.x,y:rect.y,width,height,minWidth:320,minHeight:26,frame:false,roundedCorners:false,show:false,resizable:true,
    backgroundColor:"#0b130e",title:titles[kind],icon:path.join(__dirname,"icon.ico"),autoHideMenuBar:true,
    webPreferences:{preload:path.join(__dirname,"preload.cjs"),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,autoplayPolicy:"no-user-gesture-required"},
  });
  const p={id,kind,source,win,shaded:false,fullHeight:rect.h};windows.set(id,p);
  win.webContents.setWindowOpenHandler(({ url: u }) => {
    if (/^https:\/\//.test(u)) void shell.openExternal(u);return {action:"deny"};
  });
  win.webContents.on("will-navigate",(e,url)=>{if(url!==`${ORIGIN}/`)e.preventDefault();});
  win.webContents.on("will-attach-webview",e=>e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  win.webContents.on("did-finish-load",()=>states());
  win.on("page-title-updated",e=>e.preventDefault());
  win.on("move",()=>remember(p));win.on("resize",()=>remember(p));
  win.on("close",e=>{
    if(kind==="main"){quitting=true;app.quit();}
    else if(!quitting){e.preventDefault();win.hide();remember(p);states();}
  });
  win.on("closed",()=>windows.delete(id));
  win.on("minimize",()=>{if(kind==="main") for(const other of windows.values())if(other.id!==id&&other.win.isVisible())other.win.minimize();});
  win.on("restore",()=>{if(kind==="main") for(const other of windows.values())if(other.win.isMinimized())other.win.restore();});
  win.once("ready-to-show",()=>{win.show();if(!startup)remember(p);});
  void win.loadURL(`${ORIGIN}/`);
  return p;
}
function sender(event) {
  const p=[...windows.values()].find(p=>p.win.webContents.id===event.sender.id);
  if(!p || event.senderFrame!==event.sender.mainFrame || event.senderFrame.url!==`${ORIGIN}/`) return null;
  return p;
}
function endGesture() {if(gesture){clearInterval(gesture.timer);gesture=null;states();}}
ipcMain.handle("amply:info",event=>{const p=sender(event);if(!p)throw Error("Unknown desktop window");return {id:p.id,kind:p.kind,source:p.source};});
ipcMain.on("amply:gesture",(event,m)=>{
  const p=sender(event);if(!p || !m || !["move","resize","end"].includes(m.action))return;
  if(m.action==="end"){if(gesture?.id===p.id)endGesture();return;}
  if(!["both","x","y"].includes(m.axis))return;
  endGesture();const all=rects();
  const group=m.action==="move" && p.kind!=="main"?all.filter(r=>r.id===p.id):layout.connected(p.id,all,saved.detached);
  if(!group.length)return;
  const start=screen.getCursorScreenPoint(),since=Date.now();
  gesture={id:p.id,timer:setInterval(()=>{
    if(Date.now()-since>30000 || p.win.isDestroyed()){endGesture();return;}
    const cursor=screen.getCursorScreenPoint(),dx=cursor.x-start.x,dy=cursor.y-start.y;
    let next=m.action==="move"?layout.move(group,dx,dy):layout.resize(group,m.axis==="y"?0:dx,m.axis==="x"?0:dy);
    if(m.action==="move"&&!saved.detached.includes(p.id))next=layout.snap(next,all.filter(r=>!group.some(g=>g.id===r.id)&&!saved.detached.includes(r.id)));
    apply(next);
  },16)};
});
ipcMain.on("amply:control",(event,m)=>{
  const p=sender(event);if(!p || !m || typeof m.action!=="string")return;
  if(m.action==="ready" && p.kind==="main" && !started){
    const mainRect=layout.restore(saved.windows.main,screen.getAllDisplays().map(d=>d.workArea))||defaultRect("main");
    started=true;apply([{...mainRect,id:"main"}]);
    const restore=Object.entries(saved.windows).filter(([id,r])=>id!=="main"&&r.visible&&["pl","eq","library","plugins"].includes(r.kind));
    if(restore.length)for(const [id,r]of restore)makeWindow(id,r.kind,r.source);
    else {makeWindow("pl","pl");makeWindow("eq","eq");makeWindow("library","library");}
  }else if(m.action==="close"){if(p.kind==="main")app.quit();else{p.win.hide();remember(p);states();}}
  else if(m.action==="minimize")p.win.minimize();
  else if(m.action==="detach"&&typeof m.value==="boolean"){saved.detached=m.value?[...new Set([...saved.detached,p.id])]:saved.detached.filter(id=>id!==p.id);save();states();}
  else if(m.action==="shade"){p.shaded=!p.shaded;if(p.shaded)p.fullHeight=p.win.getBounds().height;p.win.setSize(p.win.getBounds().width,p.shaded?26:p.fullHeight);remember(p);}
  else if(["open","toggle"].includes(m.action)&&typeof m.value==="string"&&m.value.length<300){
    const value=m.value;
    if(value.startsWith("source:")){const source=value.slice(7);makeWindow(`source-${Date.now()}`,"library",source);}
    else if(["pl","eq","library","plugins"].includes(value)){
      const target=windows.get(value);
      if(m.action==="toggle"&&target?.win.isVisible()){target.win.hide();remember(target);states();}else makeWindow(value,value);
    }
  }else if(m.action==="arrange"&&p.kind==="main"){
    saved.detached=[];const a=screen.getDisplayMatching(p.win.getBounds()).workArea;const b=p.win.getBounds();
    p.win.setBounds({x:a.x+32,y:a.y+32,width:b.width,height:b.height});
    for(const other of windows.values())if(other.id!=="main"){const r=defaultRect(other.kind);apply([{...r,id:other.id}]);}remember(p);states();
  }else if(["compact","full"].includes(m.action)&&p.kind==="main"){
    const all=rects(),main=all.find(r=>r.id==="main");if(!main)return;
    const height=m.action==="compact"?90:220,delta=height-main.h;
    const below=layout.connected("main",all,saved.detached).filter(r=>r.id!=="main"&&r.y>=main.y+main.h);
    apply([{...main,h:height},...layout.move(below,0,delta)]);
  }
});

app.setAppUserModelId("HiFi.AmpliPlayer");
if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(async()=>{
  Menu.setApplicationMenu(null);
  try {
    const raw=JSON.parse(fs.readFileSync(dataPath(),"utf8"));
    if(raw?.windows&&Array.isArray(raw.detached))saved={windows:raw.windows,detached:raw.detached.filter(id=>typeof id==="string")};
  }catch{/* defaults */}
  try{await startServer();makeWindow("main","main","",true);}catch{dialog.showErrorBox("AmPly cannot start","The local player address is busy or unavailable. Close other copies of AmPly and try again.");app.quit();}
  const recover=()=>{endGesture();const areas=screen.getAllDisplays().map(d=>d.workArea);apply(rects().map(r=>layout.restore(r,areas)).filter(Boolean));};
  screen.on("display-removed",recover);screen.on("display-metrics-changed",recover);
});
app.on("second-instance",()=>{const main=windows.get("main")?.win;if(main){if(main.isMinimized())main.restore();main.show();main.focus();}});
app.on("before-quit",()=>{quitting=true;endGesture();clearTimeout(saveTimer);try{fs.writeFileSync(dataPath(),JSON.stringify(saved));}catch{/* no disk */}});
app.on("window-all-closed", () => app.quit());
