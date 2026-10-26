import { usePlayer, EQ_LABELS, EQ_PRESETS } from "./player-context";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import { EqBeat } from "./EqBeat";

function VSlider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="wa-eq-col">
      <input
        aria-label={`EQ ${label}`}
        className="wa-eq-slider"
        type="range"
        min={-12}
        max={12}
        step={0.1}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        onDoubleClick={() => onChange(0)}
      />
      <span className="wa-eq-label">{label}</span>
      <span className="wa-eq-val">{value > 0 ? "+" : ""}{value.toFixed(1)}</span>
    </div>
  );
}

export function EqualizerWindow({ onAdvanced }: { onAdvanced?: () => void }) {
  const p = usePlayer();
  return (
    <div className="wa-eq">
      <div className="wa-eq-top">
        <Button variant="retro" size="retro" aria-label="Equalizer on" aria-pressed={p.eq.on} className={`wa-toggle ${p.eq.on ? "wa-state-on" : "wa-state-off"}`} onClick={() => p.setEqOn(!p.eq.on)}>
          ON
        </Button>
        <span className="wa-eq-scale">+12db</span>
        <Button variant="retro" size="retro"
          className={`wa-toggle ${p.eqPresetName ? "wa-state-on" : "wa-state-off"}`}
          aria-pressed={!!p.eqPresetName}
          title={p.eqPresetName ? `Preset: ${p.eqPresetName}` : "No preset (manual)"}
          onClick={() => {
            const names = Object.keys(EQ_PRESETS);
            const i = names.indexOf(p.eqPresetName ?? "");
            p.applyEqPreset(names[(i + 1) % names.length] ?? "Flat");
          }}
        >
          PRESETS
        </Button>
      </div>
      <div className="wa-eq-mid">
        <span className="wa-eq-scale">+0db</span>
      </div>
      <div className="wa-eq-sliders">
        <VSlider value={p.eq.preamp} onChange={p.setEqPreamp} label="PREAMP" />
        {p.eq.bands.map((v, i) => (
          <VSlider key={i} value={v} onChange={(nv) => p.setEqBand(i, nv)} label={EQ_LABELS[i] ?? ""} />
        ))}
      </div>
      <div className="wa-eq-bottom">
        <span className="wa-eq-scale">-12db</span>
        <span className="wa-eq-preset">{p.eqPresetName ?? "Manual"}</span>
        {onAdvanced && <Button variant="retro" size="retro" className="wa-toggle" aria-label="Advanced EQ settings" title="Advanced EQ and audio plug-ins" onClick={onAdvanced}><Settings2 size={12} />ADVANCED</Button>}
      </div>
      <EqBeat />
    </div>
  );
}
