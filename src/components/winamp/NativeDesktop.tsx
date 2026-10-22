import { useEffect, useState, type ReactNode } from "react";
import { Library, Plug, Minimize2, Maximize2, Columns2, Link2, Unlink, MoveDiagonal2, X, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { desktopBridge, type NativePanel, type NativeWindowState } from "@/lib/desktop-bridge";
import { MainWindow } from "./MainWindow";
import { PlaylistWindow } from "./PlaylistWindow";
import { EqualizerWindow } from "./EqualizerWindow";
import { PluginWindow } from "./PluginWindow";
import { LibraryWindow } from "./LibraryWindow";
import { IntroSplash } from "./IntroSplash";
import { useMusicLibrary } from "./use-music-library";
import { PlayerBroadcaster } from "./RemotePlayer";
import { usePlayer } from "./player-context";

function NativeFrame({panel,title,children,controls}:{panel:NativePanel;title:string;children:ReactNode;controls?:ReactNode}) {
  const [state,setState]=useState<NativeWindowState>({detached:false,grouped:false});
  const [shaded,setShaded]=useState(false);
  const bridge=desktopBridge();
  useEffect(()=>bridge?.onWindowState(setState),[bridge]);
  const gesture=(event:React.PointerEvent,action:"move"|"resize",axis:"both"|"x"|"y"="both")=>{
    if(action==="move" && (event.target as HTMLElement).closest("button"))return;
    event.preventDefault();bridge?.gesture(action,axis);
  };
  const shade=()=>{setShaded(v=>!v);bridge?.control("shade");};
  return <div className="wa-window wa-native-window" data-wa-win={panel.id} data-grouped={state.grouped} data-shaded={shaded}>
    <div className="wa-titlebar" onPointerDown={e=>gesture(e,"move")} onDoubleClick={shade}>
      <span className="wa-title-stripes"/><span className="wa-title-text">{title}</span><span className="wa-title-stripes"/>{controls}
      <Button variant="retro" size="retro" className="wa-tbtn" title={state.detached?"Join snapped windows":"Detach window"} aria-label={`${state.detached?"Join":"Detach"} ${title}`} aria-pressed={!state.detached} onClick={()=>bridge?.control("detach",!state.detached)}>{state.detached?<Unlink/>:<Link2/>}</Button>
      <Button variant="retro" size="retro" className="wa-tbtn" aria-label={`Shade ${title}`} title="Collapse to title bar" onClick={shade}><Minus/></Button>
      {panel.kind==="main" && <Button variant="retro" size="retro" className="wa-tbtn" aria-label="Minimize AmPly" title="Minimize app" onClick={()=>bridge?.control("minimize")}><Minimize2/></Button>}
      <Button variant="retro" size="retro" className="wa-tbtn" aria-label={`Close ${title}`} title={panel.kind==="main"?"Exit AmPly":"Close window"} onClick={()=>bridge?.control("close")}><X/></Button>
    </div>
    {!shaded && <><div className="wa-window-content">{children}</div>
      <div className="wa-resize-edge wa-resize-right" onPointerDown={e=>gesture(e,"resize","x")}/><div className="wa-resize-edge wa-resize-bottom" onPointerDown={e=>gesture(e,"resize","y")}/>
      <Button variant="retro" size="retro" className="wa-resize-corner" aria-label={`Resize ${title}`} title={state.grouped?"Resize joined windows":"Resize window"} onPointerDown={e=>gesture(e,"resize")}><MoveDiagonal2/></Button>
    </>}
  </div>;
}
function NativeLibrary({panel}:{panel:NativePanel}) {
  const library=useMusicLibrary();
  return <LibraryWindow library={library} initialSource={panel.source} onNewWindow={source=>desktopBridge()?.control("open",`source:${source}`)}/>;
}
export function NativeDesktop({panel}:{panel:NativePanel}) {
  const p=usePlayer(); const [intro,setIntro]=useState(panel.kind==="main");
  const [skin,setSkin]=useState("silver");const [mode,setMode]=useState("large");
  const bridge=desktopBridge();
  useEffect(()=>{
    const read=()=>{try{setSkin(JSON.parse(localStorage.getItem("wa-state")||"null")?.skin||"silver");}catch{/* default */}};
    read();window.addEventListener("storage",read);return()=>window.removeEventListener("storage",read);
  },[]);
  useEffect(()=>{
    const up=()=>bridge?.gesture("end");window.addEventListener("pointerup",up);window.addEventListener("pointercancel",up);window.addEventListener("blur",up);
    return()=>{window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",up);window.removeEventListener("blur",up);};
  },[bridge]);
  const title=panel.kind==="main"?"AMPLY · HIFI PLAYER":panel.kind==="pl"?"PLAYLIST":panel.kind==="eq"?"EQUALIZER":panel.kind==="plugins"?"ADVANCED EQ · AUDIO PLUG-INS":panel.source?`SOURCE · ${panel.source}`:"MUSIC LIBRARY";
  const controls=panel.kind==="main"?<>
    <Button variant="retro" size="retro" className="wa-tbtn" title="Audio plug-ins" aria-label="Open plug-in settings" onClick={()=>bridge?.control("open","plugins")}><Plug/></Button>
    <Button variant="retro" size="retro" className="wa-tbtn" title="Music library" aria-label="Open music library" onClick={()=>bridge?.control("open","library")}><Library/></Button>
    <Button variant="retro" size="retro" className="wa-tbtn" title="Compact player" aria-label="Compact player" onClick={()=>{setMode("small");bridge?.control("compact");}}><Minimize2/></Button>
    <Button variant="retro" size="retro" className="wa-tbtn" title="Full player" aria-label="Full player" onClick={()=>{setMode("large");bridge?.control("full");}}><Maximize2/></Button>
    <Button variant="retro" size="retro" className="wa-tbtn" title="Arrange windows" aria-label="Arrange windows" onClick={()=>bridge?.control("arrange")}><Columns2/></Button>
  </>:undefined;
  return <div className="wa-desktop wa-native-desktop" data-skin={skin} data-mode={mode}>
    {panel.kind==="main" && <PlayerBroadcaster/>}
    {intro?<IntroSplash onDone={()=>{p.ensureGraph();setIntro(false);bridge?.control("ready");}}/>:<NativeFrame panel={panel} title={title} controls={controls}>
      {panel.kind==="main"?<MainWindow onTogglePL={()=>bridge?.control("toggle","pl")} onToggleEQ={()=>bridge?.control("toggle","eq")}/>:panel.kind==="pl"?<PlaylistWindow/>:panel.kind==="eq"?<EqualizerWindow onAdvanced={()=>bridge?.control("open","plugins")}/>:panel.kind==="plugins"?<PluginWindow/>:<NativeLibrary panel={panel}/>}
    </NativeFrame>}
  </div>;
}