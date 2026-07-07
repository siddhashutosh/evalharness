"use client";

import { useState } from "react";
import { scorerColor } from "@/lib/palette";
import { truncate } from "@/lib/format";
import type { CaseResult, RunResult } from "@/lib/types";

export function CaseTable({ run, baseline }: { run: RunResult; baseline?: RunResult | null }) {
  const order = Object.keys(run.metrics.mean_score_by_scorer);
  const baseById = new Map((baseline?.cases ?? []).map((c) => [c.case_id, c]));
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="glass overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="card-label">Per-case results</div>
        <div className="text-xs text-white/40">{run.cases.length} cases · click a row to expand</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-y border-white/10 text-left text-[0.7rem] uppercase tracking-wider text-white/40">
              <th className="px-5 py-2.5 font-semibold">Case</th>
              <th className="px-3 py-2.5 font-semibold">Verdict</th>
              {order.map((s) => (
                <th key={s} className="px-3 py-2.5 text-right font-mono font-semibold normal-case">
                  {s}
                </th>
              ))}
              {baseline && <th className="px-3 py-2.5 font-semibold">vs base</th>}
              <th className="px-5 py-2.5 font-semibold">Output</th>
            </tr>
          </thead>
          <tbody>
            {run.cases.map((c) => (
              <Row
                key={c.case_id}
                c={c}
                order={order}
                prev={baseById.get(c.case_id)}
                open={open === c.case_id}
                onToggle={() => setOpen(open === c.case_id ? null : c.case_id)}
                hasBaseline={!!baseline}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  c,
  order,
  prev,
  open,
  onToggle,
  hasBaseline,
}: {
  c: CaseResult;
  order: string[];
  prev?: CaseResult;
  open: boolean;
  onToggle: () => void;
  hasBaseline: boolean;
}) {
  const byName = new Map(c.scores.map((s) => [s.scorer, s]));
  let deltaCell = <td className="px-3 py-3 text-white/30">—</td>;
  if (hasBaseline) {
    if (!prev) deltaCell = <td className="px-3 py-3 text-white/40">new</td>;
    else if (prev.passed && !c.passed)
      deltaCell = <td className="px-3 py-3 font-semibold text-status-critical">▼ regressed</td>;
    else if (!prev.passed && c.passed)
      deltaCell = <td className="px-3 py-3 font-semibold text-status-good">▲ fixed</td>;
  }

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-white/[0.06] transition hover:bg-white/[0.03]"
      >
        <td className="px-5 py-3 font-mono text-white/85">{c.case_id}</td>
        <td className="px-3 py-3">
          {c.passed ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-status-good/15 px-2 py-0.5 text-xs font-semibold text-status-good">
              ✓ pass
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-status-critical/15 px-2 py-0.5 text-xs font-semibold text-status-critical">
              ✕ fail
            </span>
          )}
        </td>
        {order.map((s) => {
          const sr = byName.get(s);
          if (!sr) return <td key={s} className="px-3 py-3 text-right text-white/30">-</td>;
          return (
            <td key={s} className="px-3 py-3 text-right">
              <span
                className="tabular-nums font-semibold"
                style={{ color: sr.passed ? scorerColor(s, order) : "#d03b3b" }}
              >
                {sr.score.toFixed(2)}
              </span>
            </td>
          );
        })}
        {hasBaseline && deltaCell}
        <td className="px-5 py-3 text-white/55">{truncate(c.error || c.output, 60)}</td>
      </tr>
      {open && (
        <tr className="bg-black/30">
          <td colSpan={order.length + (hasBaseline ? 4 : 3)} className="px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Input" value={c.input} />
              <Field label="Model output" value={c.error || c.output || "(empty)"} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {c.scores.map((s) => (
                <span
                  key={s.scorer}
                  className="chip"
                  title={s.detail}
                  style={{ borderColor: `${scorerColor(s.scorer, order)}55` }}
                >
                  <span className="font-mono">{s.scorer}</span>
                  <span className={s.passed ? "text-status-good" : "text-status-critical"}>
                    {s.score.toFixed(2)} {s.passed ? "✓" : "✕"}
                  </span>
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="card-label mb-1.5">{label}</div>
      <div className="whitespace-pre-wrap break-words text-sm text-white/80">{value}</div>
    </div>
  );
}
