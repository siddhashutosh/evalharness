import { pct, timeAgo } from "@/lib/format";
import type { RunSummary } from "@/lib/types";

export function RunHistory({
  runs,
  activeId,
  onSelect,
}: {
  runs: RunSummary[];
  activeId?: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="glass p-5">
      <div className="card-label mb-3">Run history</div>
      {runs.length === 0 ? (
        <p className="text-sm text-white/40">No runs yet. Run an eval to populate history.</p>
      ) : (
        <ul className="space-y-1.5">
          {runs.slice(0, 12).map((r) => {
            const good = r.pass_rate >= 0.999;
            return (
              <li key={r.id}>
                <button
                  onClick={() => onSelect(r.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                    activeId === r.id
                      ? "border-neon-violet/40 bg-neon-violet/10"
                      : "border-transparent hover:bg-white/[0.05]"
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: good ? "#0ca30c" : "#d03b3b" }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white/85">
                      {r.suite}
                    </span>
                    <span className="text-xs text-white/40">
                      {timeAgo(r.created_at)} · q{Math.round(r.quality * 100)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums">
                      {pct(r.pass_rate)}
                    </span>
                    <span className="text-[0.65rem] text-white/40">
                      {r.passed}/{r.total}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
