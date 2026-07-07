"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function Dashboard() {
  const [suites, setSuites] = useState<SuiteSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [quality, setQuality] = useState(1.0);

  const [run, setRun] = useState<RunResult | null>(null);
  const [baselineRun, setBaselineRun] = useState<RunResult | null>(null);
  const [gate, setGate] = useState<GateDecision | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const flash = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const refreshRuns = useCallback(() => {
    api.runs().then(setRuns).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .suites()
      .then((s) => {
        setSuites(s);
        if (s.length) setSelected((cur) => cur || s[0].name);
      })
      .catch((e) => setFatal(e instanceof ApiError ? e.message : String(e)));
    refreshRuns();
  }, [refreshRuns]);

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
      setActiveId(res.id);
      refreshRuns();
      flash(`Ran ${selected} — ${res.run.metrics.passed}/${res.run.metrics.total} passed`);
    });

  const doBaseline = () =>
    withBusy("baseline", async () => {
      const res = await api.baseline({ suite: selected, quality });
      setBaselineRun(res.run);
      setRun(res.run);
      setGate(null);
      refreshRuns();
      flash("Baseline saved — now degrade quality and run the gate", "ok");
    });

  const doGate = () =>
    withBusy("gate", async () => {
      const res = await api.gate({ suite: selected, quality });
      setRun(res.run);
      if (res.error || !res.gate) {
        setGate(null);
        flash(res.error || "No baseline to gate against", "err");
        return;
      }
      setGate(res.gate);
      const bl = res.baseline as { run?: RunResult } | undefined;
      if (bl?.run) setBaselineRun(bl.run);
      if (res.run_id) setActiveId(res.run_id);
      refreshRuns();
      flash(res.gate.passed ? "Gate passed ✓" : "Gate failed ✕", res.gate.passed ? "ok" : "err");
    });

  const loadHistory = (id: string) =>
    withBusy("history", async () => {
      const res = await api.runById(id);
      setRun(res.run);
      setGate(null);
      setActiveId(id);
    });

  if (fatal) {
    return (
      <div>
        <Nav active="dashboard" />
        <div className="mx-auto max-w-2xl px-5 py-24 text-center">
          <div className="glass-strong p-8">
            <div className="mb-3 text-4xl">🔌</div>
            <h2 className="font-display text-xl font-bold">Can&apos;t reach the backend</h2>
            <p className="mt-2 text-sm text-white/60">{fatal}</p>
            <div className="mt-5 rounded-lg border border-white/10 bg-black/40 p-4 text-left font-mono text-xs">
              <div className="text-white/40"># from the repo root</div>
              <div>pip install -e . -r server/requirements.txt</div>
              <div>uvicorn server.app:app --reload --port 8000</div>
            </div>
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
              Run suites, save baselines, and gate changes — powered by the evalharness library.
            </p>
          </div>
          <span className="chip hidden sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-status-good" /> API {api.base}
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          {/* Left rail */}
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
            <RunHistory runs={runs} activeId={activeId} onSelect={loadHistory} />
          </div>

          {/* Results */}
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
                    sub="this run"
                    accent="cyan"
                  />
                  <KpiCard
                    label="Tokens"
                    value={num(run.metrics.input_tokens + run.metrics.output_tokens)}
                    sub={`${num(run.metrics.input_tokens)} in / ${num(run.metrics.output_tokens)} out`}
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
