// Native coordinates are screen DIPs: negative coordinates are valid monitors.
function touching(a, b, tolerance = 2) {
  const ox = Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
  const oy = Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
  return (ox>2 && (Math.abs(a.y+a.h-b.y)<=tolerance || Math.abs(b.y+b.h-a.y)<=tolerance)) ||
    (oy>2 && (Math.abs(a.x+a.w-b.x)<=tolerance || Math.abs(b.x+b.w-a.x)<=tolerance));
}
function connected(id, windows, detached=[]) {
  const first=windows.find(w=>w.id===id); if(!first) return [];
  const group=[first]; if(detached.includes(id)) return group;
  for(let i=0;i<group.length;i++) for(const w of windows)
    if(!detached.includes(w.id) && !group.some(g=>g.id===w.id) && touching(group[i],w)) group.push(w);
  return group;
}
function move(windows, dx, dy) { return windows.map(w=>({...w,x:w.x+dx,y:w.y+dy})); }
function resize(windows, dx, dy) {
  if(!windows.length) return [];
  const x=Math.min(...windows.map(w=>w.x)), y=Math.min(...windows.map(w=>w.y));
  const width=Math.max(...windows.map(w=>w.x+w.w))-x, height=Math.max(...windows.map(w=>w.y+w.h))-y;
  const sx=Math.max((width+dx)/width,...windows.map(w=>(w.minW||320)/w.w));
  const sy=Math.max((height+dy)/height,...windows.map(w=>(w.minH||140)/w.h));
  return windows.map(w=>{const nx=Math.round(x+(w.x-x)*sx),ny=Math.round(y+(w.y-y)*sy);return {...w,x:nx,y:ny,w:Math.round(x+(w.x+w.w-x)*sx)-nx,h:Math.round(y+(w.y+w.h-y)*sy)-ny};});
}
function snap(windows, others, tolerance=12) {
  let dx=0,dy=0,bestX=tolerance,bestY=tolerance;
  for(const w of windows) for(const o of others) {
    if(Math.min(w.y+w.h,o.y+o.h)>Math.max(w.y,o.y)) for(const d of [o.x+o.w-w.x,o.x-w.x-w.w]) if(Math.abs(d)<bestX){bestX=Math.abs(d);dx=d;}
    if(Math.min(w.x+w.w,o.x+o.w)>Math.max(w.x,o.x)) for(const d of [o.y+o.h-w.y,o.y-w.y-w.h]) if(Math.abs(d)<bestY){bestY=Math.abs(d);dy=d;}
  }
  return move(windows,dx,dy);
}
function restore(rect, areas) {
  if(!rect || ![rect.x,rect.y,rect.w,rect.h].every(Number.isFinite) || rect.w<320 || rect.h<26) return null;
  // Keep a reachable title bar on at least one currently attached monitor.
  if(areas.some(a=>Math.min(rect.x+rect.w,a.x+a.width)-Math.max(rect.x,a.x)>=80 && rect.y>=a.y && rect.y+22<=a.y+a.height)) return rect;
  const a=areas[0]; return a ? {...rect,x:a.x+24,y:a.y+24} : rect;
}
module.exports={touching,connected,move,resize,snap,restore};