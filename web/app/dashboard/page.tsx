"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Nav } from "@/components/Nav";
import { KpiCard, PassRateRing } from "@/components/Kpi";
import { ScorerBars } from "@/components/ScorerBars";
import { CaseTable } from "@/components/CaseTable";
import { GateBanner } from "@/components/GateBanner";
import { RunControls } from "@/components/RunControls";
import { RunHistory } from "@/components/RunHistory";
import { api, ApiError } from "@/lib/api";
import { money, num } from "@/lib/format";
import type {
  GateDecision,
  RunResult,
  RunSummary,
  SuiteSummary,
} from "@/lib/types";

type Toast = { msg: string; kind: "ok" | "err" } | null;
type HistoryEntry = { id: string; suite: string; quality: number; run: RunResult };

const HISTORY_KEY = "evalharness.history.v1";
const MAX_HISTORY = 12;

function loadHistoryFromStorage(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

export default function Dashboard() {
  const [suites, setSuites] = useState<SuiteSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [quality, setQuality] = useState(1.0);

  const [run, setRun] = useState<RunResult | null>(null);
  const [baselineRun, setBaselineRun] = useState<RunResult | null>(null);
  const [gate, setGate] = useState<GateDecision | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const flash = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const record = useCallback((id: string, suite: string, q: number, r: RunResult) => {
    setHistory((prev) => {
      const next = [{ id, suite, quality: q, run: r }, ...prev].slice(0, MAX_HISTORY);
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* storage may be unavailable */
      }
      return next;
    });
    setActiveId(id);
  }, []);

  useEffect(() => {
    setHistory(loadHistoryFromStorage());
    api
      .suites()
      .then((s) => {
        setSuites(s);
        if (s.length) setSelected((cur) => cur || s[0].name);
      })
      .catch((e) => setFatal(e instanceof ApiError ? e.message : String(e)));
  }, []);

  const runSummaries: RunSummary[] = useMemo(
    () =>
      history.map((h) => ({
        id: h.id,
        suite: h.suite,
        quality: h.quality,
        mode: "demo",
        created_at: h.run.created_at,
        pass_rate: h.run.metrics.pass_rate,
        passed: h.run.metrics.passed,
        total: h.run.metrics.total,
        est_cost_usd: h.run.metrics.est_cost_usd,
      })),
    [history],
  );

  async function withBusy(name: string, fn: () => Promise<void>) {
    setBusy(true);
    setAction(name);
    try {
      await fn();
    } catch (e) {
      flash(e instanceof ApiError ? e.message : "Request failed", "err");
    } finally {
      setBusy(false);
      setAction(null);
    }
  }

  const doRun = () =>
    withBusy("run", async () => {
      const res = await api.run({ suite: selected, quality });
      setRun(res.run);
      setGate(null);
      record(res.id, selected, quality, res.run);
      flash(`Ran ${selected} — ${res.run.metrics.passed}/${res.run.metrics.total} passed`);
    });

  const doBaseline = () =>
    withBusy("baseline", async () => {
      const res = await api.baseline({ suite: selected, quality });
      setBaselineRun(res.run);
      setRun(res.run);
      setGate(null);
      record(res.id, selected, quality, res.run);
      flash("Baseline saved — now degrade quality and run the gate", "ok");
    });

  const doGate = () =>
    withBusy("gate", async () => {
      if (!baselineRun) {
        flash("Save a baseline first, then run the gate", "err");
        return;
      }
      const res = await api.gate({ suite: selected, quality, baseline: baselineRun });
      setRun(res.run);
      if (res.error || !res.gate) {
        setGate(null);
        flash(res.error || "No baseline to gate against", "err");
        return;
      }
      setGate(res.gate);
      if (res.run_id) record(res.run_id, selected, quality, res.run);
      flash(res.gate.passed ? "Gate passed ✓" : "Gate failed ✕", res.gate.passed ? "ok" : "err");
    });

  const openHistory = (id: string) => {
    const entry = history.find((h) => h.id === id);
    if (!entry) return;
    setRun(entry.run);
    setGate(null);
    setActiveId(id);
  };

  if (fatal) {
    return (
      <div>
        <Nav active="dashboard" />
        <div className="mx-auto max-w-2xl px-5 py-24 text-center">
          <div className="glass-strong p-8">
            <div className="mb-3 text-4xl">🔌</div>
            <h2 className="font-display text-xl font-bold">Couldn&apos;t load the API</h2>
            <p className="mt-2 text-sm text-white/60">{fatal}</p>
            <p className="mt-4 text-xs text-white/40">
              The dashboard uses same-origin API routes by default. Try reloading; if you&apos;re
              running locally against the Python backend, make sure it&apos;s up.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Nav active="dashboard" />
      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Evaluation dashboard</h1>
            <p className="text-sm text-white/50">
              Run suites, save baselines, and gate changes — the eval engine runs right here.
            </p>
          </div>
          <span className="chip hidden sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-status-good" /> {api.base}
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <div className="space-y-5">
            <RunControls
              suites={suites}
              selected={selected}
              onSelect={setSelected}
              quality={quality}
              onQuality={setQuality}
              onRun={doRun}
              onBaseline={doBaseline}
              onGate={doGate}
              busy={busy}
              action={action}
            />
            <RunHistory runs={runSummaries} activeId={activeId} onSelect={openHistory} />
          </div>

          <div className="space-y-5">
            {gate && <GateBanner gate={gate} />}

            {!run ? (
              <EmptyState />
            ) : (
              <div className="animate-fade-up space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2">
                    <PassRateRing
                      value={run.metrics.pass_rate}
                      passed={run.metrics.passed}
                      total={run.metrics.total}
                    />
                  </div>
                  <KpiCard
                    label="Est. cost"
                    value={money(run.metrics.est_cost_usd)}
                    sub="demo mode"
                    accent="cyan"
                  />
                  <KpiCard
                    label="Cases"
                    value={num(run.metrics.total)}
                    sub={`${run.metrics.passed} passing`}
                    accent="fuchsia"
                  />
                </div>

                <ScorerBars metrics={run.metrics} baseline={baselineRun?.metrics} />
                <CaseTable run={run} baseline={baselineRun} />
              </div>
            )}
          </div>
        </div>
      </main>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-5 py-3 text-sm font-medium shadow-glow backdrop-blur-xl ${
            toast.kind === "ok"
              ? "border-status-good/40 bg-status-good/15 text-status-good"
              : "border-status-critical/40 bg-status-critical/15 text-status-critical"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass grid place-items-center p-16 text-center">
      <div>
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-neon-fuchsia to-neon-cyan text-3xl text-ink-bg shadow-glow">
          ▶
        </div>
        <h3 className="font-display text-xl font-bold">Run your first eval</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-white/55">
          Pick a suite, then hit <span className="font-semibold text-white">Run eval</span>. Save a
          baseline at full quality, drag the slider down, and run the gate to see regressions get
          caught.
        </p>
      </div>
    </div>
  );
}
