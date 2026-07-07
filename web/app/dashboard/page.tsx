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
import { num } from "@/lib/format";
import type {
  GateDecision,
  RunResult,
  RunSummary,
  SuiteSummary,
} from "@/lib/types";

type Toast = { msg: string; kind: "ok" | "err" } | null;
type HistoryEntry = { id: string; label: string; run: RunResult };

const HISTORY_KEY = "evalharness.history.v2";
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
  const [prompt, setPrompt] = useState("");

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

  const suiteOf = useCallback(
    (name: string) => suites.find((s) => s.name === name),
    [suites],
  );

  const record = useCallback((id: string, label: string, r: RunResult) => {
    setHistory((prev) => {
      const next = [{ id, label, run: r }, ...prev].slice(0, MAX_HISTORY);
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
      .then(setSuites)
      .catch((e) => setFatal(e instanceof ApiError ? e.message : String(e)));
  }, []);

  const onSelect = (name: string) => {
    setSelected(name);
    const s = suites.find((x) => x.name === name);
    setPrompt(s?.default_prompt ?? "");
    setRun(null);
    setGate(null);
    setBaselineRun(null);
  };

  const onResetPrompt = () => {
    const s = suiteOf(selected);
    if (s) setPrompt(s.default_prompt);
  };

  const runSummaries: RunSummary[] = useMemo(
    () =>
      history.map((h) => ({
        id: h.id,
        suite: h.label,
        quality: 0,
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

  const label = () => suiteOf(selected)?.label ?? selected;

  const doRun = () =>
    withBusy("run", async () => {
      const res = await api.run({ suite: selected, prompt });
      setRun(res.run);
      setGate(null);
      record(res.id, label(), res.run);
      flash(`Ran — ${res.run.metrics.passed}/${res.run.metrics.total} passed`);
    });

  const doBaseline = () =>
    withBusy("baseline", async () => {
      const res = await api.baseline({ suite: selected, prompt });
      setBaselineRun(res.run);
      setRun(res.run);
      setGate(null);
      record(res.id, label(), res.run);
      flash("Baseline saved — now change the prompt and run the gate", "ok");
    });

  const doGate = () =>
    withBusy("gate", async () => {
      if (!baselineRun) {
        flash("Save a baseline first, then run the gate", "err");
        return;
      }
      const res = await api.gate({ suite: selected, prompt, baseline: baselineRun });
      setRun(res.run);
      if (res.error || !res.gate) {
        setGate(null);
        flash(res.error || "No baseline to gate against", "err");
        return;
      }
      setGate(res.gate);
      if (res.run_id) record(res.run_id, label(), res.run);
      flash(res.gate.passed ? "Gate passed ✓" : "Gate failed ✕", res.gate.passed ? "ok" : "err");
    });

  // One-click demo: a strong-prompt baseline, then gate with the same strong
  // prompt (passes) or a deliberately weak prompt (fails).
  const doDemo = (kind: "pass" | "fail") =>
    withBusy(`demo-${kind}`, async () => {
      const s = suiteOf(selected) ?? suites[0];
      if (!s) return;
      setSelected(s.name);
      const base = await api.baseline({ suite: s.name, prompt: s.default_prompt });
      setBaselineRun(base.run);
      record(base.id, s.label, base.run);
      const usedPrompt = kind === "pass" ? s.default_prompt : s.weak_prompt;
      setPrompt(usedPrompt);
      const g = await api.gate({ suite: s.name, prompt: usedPrompt, baseline: base.run });
      setRun(g.run);
      setGate(g.gate ?? null);
      if (g.run_id) record(g.run_id, s.label, g.run);
      flash(
        g.gate?.passed ? "Passing gate — no regression ✓" : "Failing gate — regression caught ✕",
        g.gate?.passed ? "ok" : "err",
      );
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
            <p className="mt-4 text-xs text-white/40">Try reloading the page.</p>
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
            <h1 className="font-display text-2xl font-bold">Prompt playground</h1>
            <p className="text-sm text-white/50">
              Pick an AI feature, edit its prompt, and see how prompt quality moves the score — then
              gate a change against your baseline.
            </p>
          </div>
          <span className="chip hidden sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-status-good" /> {api.base}
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <div className="space-y-5">
            <RunControls
              suites={suites}
              selected={selected}
              onSelect={onSelect}
              prompt={prompt}
              onPrompt={setPrompt}
              onResetPrompt={onResetPrompt}
              onRun={doRun}
              onBaseline={doBaseline}
              onGate={doGate}
              busy={busy}
              action={action}
            />

            <div className="glass-strong p-5">
              <div className="card-label mb-1.5">Guided demo</div>
              <p className="mb-3 text-xs text-white/50">
                One click each — a strong-prompt baseline, then a gate with the same prompt (passes)
                or a weak prompt (fails).
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => doDemo("pass")}
                  disabled={busy || suites.length === 0}
                  className="btn flex-1 border border-status-good/40 bg-status-good/10 text-status-good transition hover:bg-status-good/20 disabled:opacity-50"
                >
                  {busy && action === "demo-pass" ? <DemoSpinner /> : "✓"} Passing gate
                </button>
                <button
                  onClick={() => doDemo("fail")}
                  disabled={busy || suites.length === 0}
                  className="btn flex-1 border border-status-critical/40 bg-status-critical/10 text-status-critical transition hover:bg-status-critical/20 disabled:opacity-50"
                >
                  {busy && action === "demo-fail" ? <DemoSpinner /> : "✕"} Failing gate
                </button>
              </div>
            </div>

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
                    label="Scorers"
                    value={String(Object.keys(run.metrics.mean_score_by_scorer).length)}
                    sub="graded per case"
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

function DemoSpinner() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
  );
}

function EmptyState() {
  return (
    <div className="glass grid place-items-center p-16 text-center">
      <div>
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-neon-fuchsia to-neon-cyan text-3xl text-ink-bg shadow-glow">
          ▶
        </div>
        <h3 className="font-display text-xl font-bold">Pick a feature to begin</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-white/55">
          Choose an <span className="font-semibold text-white">AI feature</span> from the dropdown,
          then <span className="font-semibold text-white">Run eval</span> on its prompt. Or hit the
          one-click <span className="font-semibold text-status-good">Passing</span> /{" "}
          <span className="font-semibold text-status-critical">Failing</span> gate demo.
        </p>
      </div>
    </div>
  );
}
