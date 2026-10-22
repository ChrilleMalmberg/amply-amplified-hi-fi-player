import { usePlayer, EQ_LABELS, EQ_PRESETS } from "./player-context";

function VSlider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="wa-eq-col">
      <input
        aria-label={`EQ ${label}`}
        className="wa-eq-slider"
        type="range"
        min={-12}
        max={12}
        step={0.5}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        onDoubleClick={() => onChange(0)}
      />
      <span className="wa-eq-label">{label}</span>
    </div>
  );
}

export function EqualizerWindow() {
  const p = usePlayer();
  return (
    <div className="wa-eq">
      <div className="wa-eq-top">
        <button className={`wa-toggle ${p.eq.on ? "wa-on" : ""}`} onClick={() => p.setEqOn(!p.eq.on)}>
          ON
        </button>
        <span className="wa-eq-scale">+12db</span>
        <button
          className="wa-toggle"
          onClick={() => {
            const names = Object.keys(EQ_PRESETS);
            const i = names.indexOf(p.eqPresetName ?? "");
            p.applyEqPreset(names[(i + 1) % names.length] ?? "Flat");
          }}
        >
          PRESETS
        </button>
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
      </div>
    </div>
  );
}
