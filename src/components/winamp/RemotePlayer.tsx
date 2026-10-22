import { useEffect, useRef, useState, type ReactNode } from "react";
import { PlayerContext, usePlayer, type PlayerApi, type Track } from "./player-context";

const CHANNEL = "amply-desktop-player-v1";
type Message = { type: string; id?: string; method?: string; args?: unknown[]; state?: Partial<PlayerApi>; tracks?: Track[]; result?: unknown; error?: string };
const METHODS = ["ensureGraph", "addFiles", "playAt", "loadItems", "appendItems", "playItems", "saveAs", "play", "pause", "stop", "next", "prev", "seek", "setVolume", "setBalance", "setBalanceEnabled", "toggleShuffle", "toggleRepeat", "setEqOn", "resetEq", "setEqBand", "setEqPreamp", "applyEqPreset"] as const;
function stateOf(p: PlayerApi): Partial<PlayerApi> {
  return { current:p.current,playing:p.playing,paused:p.paused,time:p.time,volume:p.volume,balance:p.balance,balanceEnabled:p.balanceEnabled,audioCapabilities:p.audioCapabilities,shuffle:p.shuffle,repeat:p.repeat,sampleRate:p.sampleRate,skipped:p.skipped,duration:p.duration,eq:p.eq,eqPresetName:p.eqPresetName };
}
export function PlayerBroadcaster() {
  const p=usePlayer(); const latest=useRef(p); latest.current=p;
  const channel=useRef<BroadcastChannel | null>(null);
  useEffect(()=>{
    const bc=new BroadcastChannel(CHANNEL); channel.current=bc;
    bc.onmessage=async (event: MessageEvent<Message>)=>{
      const m=event.data, api=latest.current;
      if(m.type==="request") { bc.postMessage({type:"state",state:stateOf(api),tracks:api.tracks}); return; }
      if(m.type!=="action" || !m.method || !Array.isArray(m.args)) return;
      try {
        let result: unknown;
        if(m.method==="setTrackOrder") {
          const ids=m.args[0]; if(!Array.isArray(ids) || !ids.every(v=>typeof v==="number")) return;
          api.setTracks(old=>ids.flatMap(id=>{ const track=old.find(t=>t.id===id); return track ? [track] : []; }));
        } else if(METHODS.some(name=>name===m.method)) {
          const fn=api[m.method as typeof METHODS[number]] as (...args: unknown[])=>unknown;
          result=await fn(...m.args);
        } else return;
        if(m.id) bc.postMessage({type:"result",id:m.id,result});
      } catch { if(m.id) bc.postMessage({type:"result",id:m.id,error:"Player action failed"}); }
    };
    return ()=>{channel.current=null;bc.close();};
  },[]);
  useEffect(()=>{channel.current?.postMessage({type:"state",state:stateOf(p)});},[p]);
  useEffect(()=>{channel.current?.postMessage({type:"tracks",tracks:p.tracks});},[p.tracks]);
  return null;
}
export function RemotePlayerProvider({children}:{children:ReactNode}) {
  const [snapshot,setSnapshot]=useState<Partial<PlayerApi>>({tracks:[],current:-1,playing:false,paused:false,time:0,volume:.8,balance:0,balanceEnabled:true,audioCapabilities:{equalizer:false,balance:false},shuffle:false,repeat:false,sampleRate:44100,skipped:[],duration:0,eq:{on:false,preamp:0,bands:Array(10).fill(0)},eqPresetName:null});
  const latest=useRef(snapshot); latest.current=snapshot;
  const channel=useRef<BroadcastChannel | null>(null);
  const pending=useRef(new Map<string,{resolve:(value:unknown)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>());
  useEffect(()=>{
    const bc=new BroadcastChannel(CHANNEL);channel.current=bc;
    bc.onmessage=(event:MessageEvent<Message>)=>{const m=event.data;
      if(m.type==="state" || m.type==="tracks") setSnapshot(old=>({...old,...m.state,...(m.tracks?{tracks:m.tracks}:{})}));
      if(m.type==="result" && m.id) {const job=pending.current.get(m.id); if(job){clearTimeout(job.timer);pending.current.delete(m.id);if(m.error)job.reject(new Error(m.error));else job.resolve(m.result);}}
    };
    bc.postMessage({type:"request"});
    return ()=>{channel.current=null;bc.close();for(const job of pending.current.values()){clearTimeout(job.timer);job.reject(new Error("Window closed"));}pending.current.clear();};
  },[]);
  const send=(method:string,args:unknown[])=>channel.current?.postMessage({type:"action",method,args});
  const api={...snapshot,analyserRef:{current:null},...Object.fromEntries(METHODS.map(method=>[method,(...args:unknown[])=>send(method,args)])),
    addFiles:(files:FileList|File[])=>send("addFiles",[Array.from(files)]),
    setTracks:(update:Track[]|((old:Track[])=>Track[]))=>{const tracks=latest.current.tracks??[];send("setTrackOrder",[(typeof update==="function"?update(tracks):update).map(t=>t.id)]);},
    saveAs:(name:string)=>new Promise((resolve,reject)=>{const id=crypto.randomUUID();const timer=setTimeout(()=>{pending.current.delete(id);reject(new Error("Player unavailable"));},15000);pending.current.set(id,{resolve,reject,timer});channel.current?.postMessage({type:"action",method:"saveAs",args:[name],id});}),
  } as PlayerApi;
  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}