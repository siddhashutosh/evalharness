import { scorerColor } from "@/lib/palette";
import type { AggregateMetrics } from "@/lib/types";

// Per-scorer mean score (0..1). Categorical identity -> fixed color order.
// Direct value labels satisfy the relief rule for the floor-band palette.
export function ScorerBars({
  metrics,
  baseline,
}: {
  metrics: AggregateMetrics;
  baseline?: AggregateMetrics | null;
}) {
  const entries = Object.entries(metrics.mean_score_by_scorer);
  const order = entries.map(([name]) => name);

  if (entries.length === 0) {
    return <div className="text-sm text-white/40">No scorer data.</div>;
  }

  return (
    <div className="glass p-5">
      <div className="card-label mb-4">Mean score by scorer</div>
      <div className="space-y-4">
        {entries.map(([name, mean]) => {
          const color = scorerColor(name, order);
          const base = baseline?.mean_score_by_scorer?.[name];
          const delta = base != null ? mean - base : null;
          return (
            <div key={name}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <span
                    className="h-2.5 w-2.5 rounded-[3px]"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-mono text-white/85">{name}</span>
                </span>
                <span className="flex items-center gap-2 tabular-nums">
                  {delta != null && Math.abs(delta) >= 0.005 && (
                    <span
                      className="text-xs font-semibold"
                      style={{ color: delta > 0 ? "#0ca30c" : "#d03b3b" }}
                    >
                      {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}
                    </span>
                  )}
                  <span className="font-semibold text-white/90">{mean.toFixed(2)}</span>
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, mean * 100)}%`,
                    backgroundColor: color,
                    transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
