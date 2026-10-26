import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
const require=createRequire(import.meta.url);
const native=require("../../electron/window-layout.cjs");
const windows=[{id:"main",x:20,y:40,w:550,h:220},{id:"pl",x:20,y:260,w:550,h:300},{id:"eq",x:20,y:560,w:550,h:260},{id:"library",x:-1800,y:100,w:680,h:640}];
describe("real desktop windows",()=>{
  it("maximizes the connected player group using Electron workArea width and height",()=>{
    const result=native.maximize(native.connected("main",windows),{x:0,y:0,width:1100,height:1560});
    expect(result.map((r:unknown)=>native.toBounds(r))).toEqual([
      {x:0,y:0,width:1100,height:440},{x:0,y:440,width:1100,height:600},{x:0,y:1040,width:1100,height:520},
    ]);
  });
  it("maximizes an auxiliary panel alone on its negative-coordinate monitor",()=>{
    expect(native.maximize([windows[3]],{x:-1920,y:0,width:1920,height:1080}).map((r:unknown)=>native.toBounds(r))).toEqual([{x:-1920,y:0,width:1920,height:1080}]);
    expect(windows[0]).toMatchObject({x:20,y:40,w:550,h:220});
  });
  it("rejects invalid bounds before they reach Electron",()=>{
    expect(native.toBounds({x:0,y:0,w:NaN,h:200})).toBeNull();
    expect(native.toBounds({x:Infinity,y:0,w:500,h:200})).toBeNull();
    expect(native.maximize(windows,{x:0,y:0,w:1920,h:1080})).toEqual([]);
  });
  it("allows the library on a monitor left of the player",()=>{
    expect(native.move([windows[3]],-50,25)[0]).toMatchObject({x:-1850,y:125});
  });
  it("moves the snapped player group across negative screen coordinates without moving the library",()=>{
    const group=native.connected("main",windows);
    expect(native.move(group,-900,-100).map((r:{id:string;x:number;y:number})=>[r.id,r.x,r.y])).toEqual([["main",-880,-60],["pl",-880,160],["eq",-880,460]]);
  });
  it("keeps an explicitly detached EQ separate",()=>{
    expect(native.connected("main",windows,["eq"]).map((r:{id:string})=>r.id)).toEqual(["main","pl"]);
  });
  it("preserves joined diagonal resizing",()=>{
    const resized=native.resize(native.connected("main",windows),110,156);
    expect(resized.map((r:{w:number;h:number;y:number})=>[r.w,r.h,r.y])).toEqual([[660,264,40],[660,360,304],[660,312,664]]);
  });
  it("restores library coordinates on the left-hand display",()=>{
    expect(native.restore(windows[3],[{x:0,y:0,width:1920,height:1080},{x:-1920,y:0,width:1920,height:1080}])).toEqual(windows[3]);
  });
  it("recovers the library when its monitor is removed",()=>{
    expect(native.restore(windows[3],[{x:0,y:0,width:1920,height:1080}])).toMatchObject({x:24,y:24});
  });
});