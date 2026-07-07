import type { SuiteSummary } from "@/lib/types";
import { pct } from "@/lib/format";

export function RunControls({
  suites,
  selected,
  onSelect,
  quality,
  onQuality,
  onRun,
  onBaseline,
  onGate,
  busy,
  action,
}: {
  suites: SuiteSummary[];
  selected: string;
  onSelect: (name: string) => void;
  quality: number;
  onQuality: (q: number) => void;
  onRun: () => void;
  onBaseline: () => void;
  onGate: () => void;
  busy: boolean;
  action: string | null;
}) {
  const suite = suites.find((s) => s.name === selected);
  return (
    <div className="glass-strong p-5">
      <div className="card-label mb-3">Suite</div>
      <div className="flex flex-wrap gap-2">
        {suites.map((s) => (
          <button
            key={s.name}
            onClick={() => onSelect(s.name)}
            disabled={busy}
            className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition disabled:opacity-60 ${
              s.name === selected
                ? "border-neon-violet/50 bg-neon-violet/15 text-white shadow-glow"
                : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {suite && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="chip">{suite.num_cases} cases</span>
          <span className="chip font-mono">{suite.target_model}</span>
          {suite.scorers.map((sc) => (
            <span key={sc.type} className="chip font-mono">
              {sc.type}
              {sc.required && <span className="text-neon-cyan">•req</span>}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="card-label">
            Simulated model quality
          </span>
          <span className="font-display text-lg font-bold tabular-nums text-white">
            {pct(quality)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={quality}
          disabled={busy}
          onChange={(e) => onQuality(parseFloat(e.target.value))}
          className="w-full"
        />
        <p className="mt-2 text-xs text-white/45">
          Demo mode answers the golden set at this quality — drag it down, then run the gate to
          watch regressions get caught. (Live mode calls the real model.)
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <button onClick={onRun} disabled={busy} className="btn-primary flex-1">
          {busy && action === "run" ? <Spinner /> : "▶"} Run eval
        </button>
        <button onClick={onBaseline} disabled={busy} className="btn-ghost">
          {busy && action === "baseline" ? <Spinner /> : "◆"} Save baseline
        </button>
        <button onClick={onGate} disabled={busy} className="btn-ghost">
          {busy && action === "gate" ? <Spinner /> : "⛬"} Run gate
        </button>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
  );
}
