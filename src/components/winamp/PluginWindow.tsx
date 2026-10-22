import { useState } from "react";
import { Check, Ban, Plug, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { audioPluginCatalog, type AudioPluginId } from "@/lib/audio-plugins";
import { usePlayer, EQ_PRESETS } from "./player-context";
import { EqualizerWindow } from "./EqualizerWindow";

export function PluginWindow() {
  const p = usePlayer();
  const [selected, setSelected] = useState<AudioPluginId>("equalizer");
  const catalog = audioPluginCatalog(p.audioCapabilities);
  const plugin = catalog.find(item => item.id === selected);
  if (!plugin) return null;
  const enabled = selected === "equalizer" ? p.eq.on : selected === "balance" ? p.balanceEnabled : false;
  return (
    <section className="wa-plugins" aria-label="Audio plug-in settings">
      <div className="wa-plugin-host"><Plug size={16} /><span>WEB AUDIO HOST</span><span>2 built-in processors</span></div>
      <div className="wa-plugin-body">
        <nav className="wa-plugin-list" aria-label="Audio plug-ins">
          {catalog.map(item => <Button key={item.id} variant="retro" size="retro" className={`wa-plugin-item ${selected === item.id ? "wa-selected" : ""}`} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
            <span>{item.name}</span><small>{item.format}</small>
            <small className="wa-plugin-availability">{item.supported ? <Check size={12} /> : <Ban size={12} />}{item.supported ? "Supported" : "Unavailable"}</small>
          </Button>)}
        </nav>
        <div className="wa-plugin-detail">
          <h2>{plugin.name}</h2>
          <div className="wa-plugin-state">{plugin.supported ? (enabled ? "ENABLED" : "DISABLED · BYPASSED") : "UNAVAILABLE"}</div>
          <label className="wa-plugin-switch"><input type="checkbox" aria-label={`Enable ${plugin.name}`} checked={enabled} disabled={!plugin.supported} onChange={e => selected === "equalizer" ? p.setEqOn(e.target.checked) : p.setBalanceEnabled(e.target.checked)} />Enabled</label>
          {!plugin.supported && <p className="wa-plugin-notice">{plugin.reason}</p>}
          {plugin.supported && selected === "equalizer" && <>
            <label className="wa-plugin-field">Preset<select className="wa-library-select" aria-label="Equalizer preset" value={p.eqPresetName ?? "Manual"} onChange={e => p.applyEqPreset(e.target.value)}><option value="Manual" disabled>Manual</option>{Object.keys(EQ_PRESETS).map(name => <option key={name}>{name}</option>)}</select></label>
            <EqualizerWindow />
          </>}
          {plugin.supported && selected === "balance" && <div className="wa-plugin-balance">
            <label htmlFor="plugin-balance">Stereo balance</label>
            <input id="plugin-balance" aria-label="Plug-in stereo balance" className="wa-range wa-balance" type="range" min={-1} max={1} step={0.01} value={p.balance} onChange={e => p.setBalance(Number(e.target.value))} />
            <div className="wa-plugin-balance-scale"><span>LEFT</span><output>{p.balance === 0 ? "CENTER" : `${p.balance < 0 ? "L" : "R"} ${Math.round(Math.abs(p.balance) * 100)}%`}</output><span>RIGHT</span></div>
            <Button variant="retro" size="retro" className="wa-toggle" onClick={() => p.setBalance(0)}><RotateCcw size={12} />CENTER</Button>
          </div>}
        </div>
      </div>
      <div className="wa-plugin-footer">Native plug-in hosting: unavailable in web and current Windows editions</div>
    </section>
  );
}