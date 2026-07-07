import { pct } from "@/lib/format";

export function KpiCard({
  label,
  value,
  sub,
  accent = "violet",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "violet" | "cyan" | "fuchsia";
}) {
  const bar =
    accent === "cyan"
      ? "from-neon-cyan/80 to-neon-cyan/0"
      : accent === "fuchsia"
        ? "from-neon-fuchsia/80 to-neon-fuchsia/0"
        : "from-neon-violet/80 to-neon-violet/0";
  return (
    <div className="glass relative overflow-hidden p-5">
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${bar}`} />
      <div className="card-label">{label}</div>
      <div className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-white/45">{sub}</div>}
    </div>
  );
}

/** SVG donut showing pass rate, with the big number in the center. */
export function PassRateRing({ value, passed, total }: { value: number; passed: number; total: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, value)) * c;
  return (
    <div className="glass flex items-center gap-5 p-5">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <defs>
            <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e879f9" />
              <stop offset="50%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke="url(#ring)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            style={{ transition: "stroke-dasharray 0.7s cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-2xl font-extrabold tabular-nums">{pct(value)}</div>
          <div className="text-[0.65rem] uppercase tracking-wider text-white/45">pass rate</div>
        </div>
      </div>
      <div>
        <div className="card-label">Cases passed</div>
        <div className="mt-1 font-display text-2xl font-bold tabular-nums">
          {passed}
          <span className="text-white/40"> / {total}</span>
        </div>
        <div className="mt-2 text-xs text-white/50">
          {total - passed === 0 ? "All cases passing" : `${total - passed} failing`}
        </div>
      </div>
    </div>
  );
}
