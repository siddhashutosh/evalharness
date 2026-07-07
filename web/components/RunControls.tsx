import type { SuiteSummary } from "@/lib/types";

export function RunControls({
  suites,
  selected,
  onSelect,
  prompt,
  onPrompt,
  onResetPrompt,
  onRun,
  onBaseline,
  onGate,
  busy,
  action,
}: {
  suites: SuiteSummary[];
  selected: string;
  onSelect: (name: string) => void;
  prompt: string;
  onPrompt: (v: string) => void;
  onResetPrompt: () => void;
  onRun: () => void;
  onBaseline: () => void;
  onGate: () => void;
  busy: boolean;
  action: string | null;
}) {
  const suite = suites.find((s) => s.name === selected);
  const hasSelection = !!suite;
  const p = prompt.toLowerCase();

  return (
    <div className="glass-strong p-5">
      {/* Feature dropdown */}
      <label className="card-label mb-2 block">AI feature</label>
      <div className="relative">
        <select
          value={selected}
          disabled={busy}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full appearance-none rounded-xl border border-white/15 bg-ink-raised/80 px-3.5 py-2.5 pr-9 text-sm font-medium text-white outline-none transition focus:border-neon-violet/60 disabled:opacity-60"
        >
          <option value="" disabled>
            Select an AI feature…
          </option>
          {suites.map((s) => (
            <option key={s.name} value={s.name} className="bg-ink-panel">
              {s.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/50">
          ▾
        </span>
      </div>
      {suite && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-white/50">{suite.description}</span>
        </div>
      )}
      {suite && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="chip">{suite.num_cases} cases</span>
          {suite.scorers.map((sc) => (
            <span key={sc.type} className="chip font-mono">
              {sc.type}
              {sc.required && <span className="text-neon-cyan">•req</span>}
            </span>
          ))}
        </div>
      )}

      {/* Prompt box */}
      <div className="mt-5 flex items-center justify-between">
        <label className="card-label">Your system prompt</label>
        {hasSelection && (
          <button
            onClick={onResetPrompt}
            disabled={busy}
            className="text-xs text-neon-cyan transition hover:underline disabled:opacity-50"
          >
            reset to default
          </button>
        )}
      </div>
      <textarea
        value={prompt}
        readOnly={!hasSelection}
        disabled={busy}
        onChange={(e) => onPrompt(e.target.value)}
        rows={6}
        placeholder={
          hasSelection
            ? "Edit the prompt for this feature…"
            : "Select an AI feature above to edit its prompt."
        }
        className={`mt-1.5 w-full resize-y rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed outline-none transition ${
          hasSelection
            ? "border-white/15 bg-black/40 text-white/90 focus:border-neon-violet/60"
            : "cursor-not-allowed border-white/10 bg-white/[0.02] text-white/40"
        }`}
      />

      {/* Live prompt-quality checklist */}
      {suite && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="card-label mb-2">Prompt quality — more ✓ means more cases pass</div>
          <ul className="space-y-1.5">
            {suite.signals.map((sig) => {
              const ok = p.includes(sig.text.toLowerCase());
              return (
                <li key={sig.text} className="flex items-start gap-2 text-xs">
                  <span
                    className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[0.6rem] ${
                      ok ? "bg-status-good/20 text-status-good" : "bg-white/10 text-white/40"
                    }`}
                  >
                    {ok ? "✓" : "○"}
                  </span>
                  <span className={ok ? "text-white/75" : "text-white/45"}>{sig.tip}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-2.5">
        <button onClick={onRun} disabled={busy || !hasSelection} className="btn-primary flex-1">
          {busy && action === "run" ? <Spinner /> : "▶"} Run eval
        </button>
        <button onClick={onBaseline} disabled={busy || !hasSelection} className="btn-ghost">
          {busy && action === "baseline" ? <Spinner /> : "◆"} Baseline
        </button>
        <button onClick={onGate} disabled={busy || !hasSelection} className="btn-ghost">
          {busy && action === "gate" ? <Spinner /> : "⛬"} Gate
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
