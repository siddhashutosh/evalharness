import type { GateDecision } from "@/lib/types";

const KIND_LABEL: Record<string, string> = {
  case_regression: "Case regression",
  pass_rate_drop: "Pass-rate drop",
  scorer_drop: "Scorer drop",
};

export function GateBanner({ gate }: { gate: GateDecision }) {
  if (gate.passed) {
    return (
      <div className="glass flex items-center gap-4 border-status-good/30 bg-status-good/[0.08] p-5">
        <span className="grid h-11 w-11 animate-pulse-ring place-items-center rounded-full bg-status-good/20 text-xl text-status-good">
          ✓
        </span>
        <div>
          <div className="font-display text-lg font-bold text-status-good">Gate passed</div>
          <div className="text-sm text-white/55">
            No regression against the baseline. Safe to ship.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="glass border-status-critical/30 bg-status-critical/[0.08] p-5">
      <div className="flex items-center gap-4">
        <span className="grid h-11 w-11 animate-pulse-ring-red place-items-center rounded-full bg-status-critical/20 text-xl text-status-critical">
          ✕
        </span>
        <div>
          <div className="font-display text-lg font-bold text-status-critical">Gate failed</div>
          <div className="text-sm text-white/55">
            {gate.reasons.length} regression signal{gate.reasons.length === 1 ? "" : "s"} — this
            change would fail CI.
          </div>
        </div>
      </div>
      <ul className="mt-4 space-y-2 border-t border-white/10 pt-4">
        {gate.reasons.map((r, i) => (
          <li key={i} className="flex gap-2.5 text-sm">
            <span className="chip shrink-0 border-status-critical/25 bg-status-critical/10 text-status-critical">
              {KIND_LABEL[r.kind] ?? r.kind}
            </span>
            <span className="text-white/70">{r.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
