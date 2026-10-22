import { describe, expect, it } from "vitest";
import { savePlayerSkin } from "@/lib/player-skins";

describe("Saved native skins",()=>{
  it("changes the skin without removing saved window visibility and positions",()=>{
    let value=JSON.stringify({v:4,skin:"silver",pos:{main:{x:32,y:80}},show:{eq:false}});
    savePlayerSkin("ruby",{getItem:()=>value,setItem:(_key,next)=>{value=next;}});
    expect(JSON.parse(value)).toEqual({v:4,skin:"ruby",pos:{main:{x:32,y:80}},show:{eq:false}});
  });
  it("rejects a skin not in the shared catalog",()=>{
    let value='{"v":4,"skin":"silver"}';
    savePlayerSkin("unknown",{getItem:()=>value,setItem:(_key,next)=>{value=next;}});
    expect(JSON.parse(value).skin).toBe("silver");
  });
});