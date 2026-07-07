import Link from "next/link";
import { Nav } from "@/components/Nav";
import { GateBanner } from "@/components/GateBanner";
import type { GateDecision } from "@/lib/types";

// Illustrative outcomes so visitors see both states at a glance.
const PASS_SAMPLE: GateDecision = { passed: true, reasons: [] };
const FAIL_SAMPLE: GateDecision = {
  passed: false,
  reasons: [
    {
      kind: "case_regression",
      detail: "case 'australia' regressed pass → fail (contains: missing expected)",
    },
    {
      kind: "pass_rate_drop",
      detail: "pass rate dropped 100.0% → 75.0% (delta 25.0% > tolerance 0.0%)",
    },
    { kind: "scorer_drop", detail: "scorer 'llm_judge' mean dropped 0.950 → 0.750" },
  ],
};

const FEATURES = [
  {
    icon: "◎",
    title: "Golden test sets",
    body: "Versioned datasets of inputs, expected answers, and grading rubrics — your ground truth, in YAML or JSONL.",
    accent: "from-neon-fuchsia to-neon-violet",
  },
  {
    icon: "⚖︎",
    title: "LLM-as-judge",
    body: "A strong model grades open-ended output against a rubric and returns a schema-validated verdict — not brittle string matching.",
    accent: "from-neon-violet to-neon-cyan",
  },
  {
    icon: "⌁",
    title: "Five scorers",
    body: "Exact, regex, contains, local semantic embedding, and LLM-judge — composed per suite, each measuring one thing.",
    accent: "from-neon-cyan to-neon-fuchsia",
  },
  {
    icon: "⤳",
    title: "Regression detection",
    body: "Compare any run to a saved baseline. Catch cases that flip pass→fail and aggregate drops beyond your tolerance.",
    accent: "from-neon-fuchsia to-neon-cyan",
  },
  {
    icon: "⛬",
    title: "CI quality gate",
    body: "One command exits non-zero when quality drops. A prompt or model change that regresses turns the build red.",
    accent: "from-neon-violet to-neon-fuchsia",
  },
  {
    icon: "⧉",
    title: "Cheap & reproducible",
    body: "A content-addressed response cache makes re-runs free and gate decisions deterministic despite model randomness.",
    accent: "from-neon-cyan to-neon-violet",
  },
];

const PIPELINE = ["Golden set", "Run model", "Score", "Compare baseline", "Pass / FAIL gate"];

export default function Home() {
  return (
    <div>
      <Nav active="home" />

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-20 text-center sm:pt-28">
        <div className="animate-fade-up">
          <span className="chip mx-auto mb-6 w-fit border-neon-violet/30 bg-neon-violet/10 text-neon-violet">
            <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan" /> test infrastructure for
            probabilistic systems
          </span>
          <h1 className="mx-auto max-w-4xl font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl">
            Ship LLM changes <br className="hidden sm:block" />
            <span className="gradient-text animate-gradient-pan bg-[length:200%_auto]">
              without guessing
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">evalharness</code> is
            pytest for LLM outputs — golden sets, LLM-as-judge scoring, and a regression gate that
            fails the build when quality drops. Run it live from this dashboard.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard" className="btn-primary px-6 py-3 text-base">
              Open the dashboard →
            </Link>
            <a
              href="https://github.com/siddhashutosh/evalharness"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost px-6 py-3 text-base"
            >
              View the code
            </a>
          </div>
        </div>

        {/* Pipeline strip */}
        <div className="mx-auto mt-16 flex max-w-4xl flex-wrap items-center justify-center gap-2 text-sm">
          {PIPELINE.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span className="glass px-4 py-2 font-medium text-white/85">{step}</span>
              {i < PIPELINE.length - 1 && (
                <span className="text-neon-violet/70">→</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-5 py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group glass p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]"
            >
              <div
                className={`mb-4 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${f.accent} text-xl text-ink-bg shadow-glow`}
              >
                {f.icon}
              </div>
              <h3 className="mb-1.5 font-display text-lg font-bold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-white/60">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why it stands out */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="glass-strong overflow-hidden p-8 sm:p-12">
          <div className="grid gap-8 sm:grid-cols-2 sm:items-center">
            <div>
              <h2 className="font-display text-3xl font-bold leading-tight">
                Most evals are a script that <span className="gradient-text">prints outputs</span>.
              </h2>
              <p className="mt-4 text-white/60">
                This is the opposite: a reusable framework with a pinned, cached, reproducible
                pipeline; composable scorers including a structured LLM judge; an explicit
                regression algorithm; and a gate that actually fails the build.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-5 font-mono text-[13px] leading-relaxed">
              <div className="text-white/40"># save a baseline, then gate every change</div>
              <div>
                <span className="text-neon-cyan">$</span> evalharness baseline suite.yaml
              </div>
              <div>
                <span className="text-neon-cyan">$</span> evalharness gate suite.yaml \
              </div>
              <div className="pl-4">--baseline baseline.json</div>
              <div className="mt-2 text-status-critical">GATE FAILED</div>
              <div className="text-white/50">- case &apos;australia&apos; regressed pass → fail</div>
              <div className="text-white/50">- pass rate 100% → 75%</div>
              <div className="mt-1 text-white/40"># exit code 1 → build turns red</div>
            </div>
          </div>
        </div>
      </section>

      {/* Two outcomes */}
      <section className="mx-auto max-w-5xl px-5 py-12">
        <div className="mb-8 text-center">
          <h2 className="font-display text-3xl font-bold">
            Two outcomes, <span className="gradient-text">one gate</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-white/60">
            Every change is graded against your baseline. If quality holds, the gate is green and
            you ship. If it slips, the gate goes red and tells you exactly what broke — down to the
            case.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-status-good">
              <span className="h-2 w-2 rounded-full bg-status-good" /> Quality held → ship it
            </div>
            <GateBanner gate={PASS_SAMPLE} />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-status-critical">
              <span className="h-2 w-2 rounded-full bg-status-critical" /> Quality dropped → build
              fails
            </div>
            <GateBanner gate={FAIL_SAMPLE} />
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-white/45">
          Want to trigger both yourself?{" "}
          <Link href="/dashboard" className="text-neon-cyan underline-offset-4 hover:underline">
            Open the dashboard
          </Link>{" "}
          and use the one-click guided demo.
        </p>
      </section>

      <footer className="mx-auto max-w-7xl px-5 py-10 text-center text-sm text-white/40">
        Built with the evalharness Python library · FastAPI + Next.js
      </footer>
    </div>
  );
}
